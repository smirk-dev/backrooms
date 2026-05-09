import {
  Box3,
  Frustum,
  Matrix4,
  Vector3,
  type Camera,
  type Mesh,
} from "three";
import type { Tile } from "./Tile";
import type { Fader } from "../render/Fader";

export interface Trigger {
  bounds: Box3;
  onEnter?: (playerPos: Vector3) => void;
  onLeave?: () => void;
  oneShot?: boolean;
  /** Internal: tracks whether the player was inside last frame. */
  _inside?: boolean;
  /** Internal: marked true after firing if oneShot. */
  _consumed?: boolean;
}

const SCRATCH = new Vector3();

/**
 * Fires onEnter/onLeave callbacks as the player crosses any registered AABB.
 * SeamTricks (looped corridors, blink-teleports) build on top of this.
 */
export class TriggerSystem {
  private triggers: Trigger[] = [];

  add(t: Trigger): Trigger {
    this.triggers.push(t);
    return t;
  }

  clear(): void {
    this.triggers.length = 0;
  }

  update(playerPos: Vector3): void {
    for (const t of this.triggers) {
      if (t._consumed) continue;
      const inside = t.bounds.containsPoint(playerPos);
      if (inside && !t._inside) {
        t._inside = true;
        t.onEnter?.(playerPos);
        if (t.oneShot) t._consumed = true;
      } else if (!inside && t._inside) {
        t._inside = false;
        t.onLeave?.();
      }
    }
  }
}

/** Convenience builder: looped corridor — entering A teleports to B (preserves yaw). */
export function loopedCorridor(
  triggers: TriggerSystem,
  a: Box3,
  b: Box3,
  playerPos: Vector3
): void {
  const aCenter = a.getCenter(new Vector3());
  const bCenter = b.getCenter(new Vector3());

  triggers.add({
    bounds: a,
    onEnter: () => {
      // Teleport from A to the equivalent local point in B, but flagged so we don't immediately re-trigger.
      SCRATCH.copy(playerPos).sub(aCenter).add(bCenter);
      playerPos.copy(SCRATCH);
    },
  });
  triggers.add({
    bounds: b,
    onEnter: () => {
      SCRATCH.copy(playerPos).sub(bCenter).add(aCenter);
      playerPos.copy(SCRATCH);
    },
  });
}

/** Single trigger that fades to black, teleports the player, fades back. */
export function blinkTeleport(
  triggers: TriggerSystem,
  zone: Box3,
  destination: Vector3,
  fader: Fader,
  playerPos: Vector3,
  oneShot = true
): Trigger {
  return triggers.add({
    bounds: zone,
    oneShot,
    onEnter: () => {
      void fader.blink(() => {
        playerPos.copy(destination);
      });
    },
  });
}

/**
 * ShiftingGeometry: when a tile is fully occluded from the player's view (not in
 * frustum), swap its main wall meshes for an alternate look. The first render
 * after the swap, the player sees a different room — but only if they look back.
 */
export class ShiftingGeometry {
  readonly entries: { tile: Tile; alt: Mesh[]; orig: Mesh[]; swapped: boolean }[] = [];
  private frustum = new Frustum();
  private projScreen = new Matrix4();

  clear(): void {
    this.entries.length = 0;
  }

  add(tile: Tile, makeAlt: () => Mesh[]): void {
    const alt = makeAlt();
    this.entries.push({ tile, alt, orig: tile.mainMeshes.slice(), swapped: false });
  }

  update(camera: Camera): void {
    this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen);

    for (const entry of this.entries) {
      const center = entry.tile.centerWorld(SCRATCH);
      // Conservative bounding sphere around tile center.
      const visible = this.frustum.containsPoint(center);
      if (!visible) {
        // Outside frustum — randomly toggle every ~1.5s for a given tile.
        if (Math.random() < 0.012) this.swap(entry);
      }
    }
  }

  private swap(entry: { tile: Tile; alt: Mesh[]; orig: Mesh[]; swapped: boolean }): void {
    const showing = entry.swapped ? entry.alt : entry.orig;
    const hiding = entry.swapped ? entry.orig : entry.alt;
    for (const m of showing) entry.tile.group.remove(m);
    for (const m of hiding) entry.tile.group.add(m);
    entry.swapped = !entry.swapped;
  }
}
