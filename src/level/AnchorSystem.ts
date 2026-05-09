import type { Vector3 } from "three";
import type { Floor } from "./Floor";
import type { SanitySystem } from "../sanity/SanitySystem";

/**
 * Walks the floor's anchor list each frame. When the player walks within
 * pickup distance, the anchor is consumed: sanity ticks up by RECOVERY_ANCHOR
 * and the anchor fades out.
 */
export class AnchorSystem {
  private grantedFor = new WeakSet<object>();

  constructor(private sanity: SanitySystem) {}

  setFloor(_floor: Floor): void {
    // floor reference held implicitly via the update call; nothing to retain here.
  }

  update(dt: number, floor: Floor, playerPos: Vector3): void {
    for (let i = floor.anchors.length - 1; i >= 0; i--) {
      const a = floor.anchors[i];
      const wasConsumed = a.consumed;
      const done = a.tick(dt, playerPos);
      // Grant sanity exactly once per anchor at the moment of consumption.
      if (!wasConsumed && a.consumed && !this.grantedFor.has(a)) {
        this.grantedFor.add(a);
        this.sanity.grantAnchor();
      }
      if (done) {
        floor.group.remove(a.object);
        a.dispose();
        floor.anchors.splice(i, 1);
      }
    }
  }
}
