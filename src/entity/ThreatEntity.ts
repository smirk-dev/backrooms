import {
  BoxGeometry,
  Camera,
  Frustum,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";
import type { EventBus, ThreatState } from "../core/EventBus";
import type { Floor } from "../level/Floor";
import { TILE_SIZE } from "../level/Tile";
import { Hearing } from "./Hearing";
import { ThreatFSM } from "./ThreatFSM";

const ALERTED_STEP_SECS = 3.0;
const HUNTING_STEP_SECS = 1.2;
const KILL_DISTANCE = 1.05;
const SCRATCH_A = new Vector3();
const SCRATCH_B = new Vector3();

/**
 * The single entity. Lives in tile-space — its position is one of the floor's
 * tile centers, lerped toward a target tile. Movement is "supernatural"
 * (no pathfinding, ignores walls/doors). It only moves while:
 *   - in Alerted: every ~3s, prefers tiles outside the player's frustum
 *   - in Hunting: every ~1.2s, can enter the player's frustum
 *
 * Visual is a placeholder — a tall thin dark silhouette with two emissive eyes.
 * Hidden in Dormant state.
 */
export class ThreatEntity {
  readonly group: Group;
  readonly hearing: Hearing;
  readonly fsm: ThreatFSM;

  private mesh: Group;
  private eyesL: Mesh;
  private eyesR: Mesh;

  /** Current tile (integer coords). */
  tileX = 0;
  tileZ = 0;
  /** Smoothly lerped world position for rendering. */
  worldPos = new Vector3(0, 0, 0);
  /** Last move target tile center (world). */
  private moveFrom = new Vector3();
  private moveTo = new Vector3();
  private moveT = 1; // 1 = arrived
  private moveDur = ALERTED_STEP_SECS;
  private nextStepIn = ALERTED_STEP_SECS;

  private floor: Floor | null = null;
  private frustum = new Frustum();
  private projScreen = new Matrix4();
  private elapsed = 0;
  private lastDeathAt = -Infinity;
  private dyingPlayer = false;
  private nextScrapeIn = 2.5;

  constructor(private bus: EventBus, opts?: { huntingCap?: number; scriptedHuntingOnly?: boolean }) {
    this.group = new Group();
    this.group.visible = false;

    // Tall thin silhouette
    this.mesh = new Group();
    const body = new Mesh(
      new BoxGeometry(0.45, 2.2, 0.32),
      new MeshStandardMaterial({ color: 0x0a0907, roughness: 0.95, emissive: 0x0a0907 })
    );
    body.position.y = 1.1;
    this.mesh.add(body);
    const head = new Mesh(
      new BoxGeometry(0.32, 0.32, 0.3),
      new MeshStandardMaterial({ color: 0x0a0907, roughness: 1 })
    );
    head.position.y = 2.4;
    this.mesh.add(head);

    const eyeMat = new MeshBasicMaterial({ color: 0xffe6a0 });
    this.eyesL = new Mesh(new BoxGeometry(0.05, 0.04, 0.02), eyeMat);
    this.eyesL.position.set(-0.07, 2.42, 0.16);
    this.eyesR = new Mesh(new BoxGeometry(0.05, 0.04, 0.02), eyeMat);
    this.eyesR.position.set(0.07, 2.42, 0.16);
    this.mesh.add(this.eyesL, this.eyesR);

    this.group.add(this.mesh);

    this.hearing = new Hearing(
      bus,
      () => this.worldPos,
      () => this.elapsed
    );
    this.fsm = new ThreatFSM(bus, opts);

    this.bus.on("entity.statechange", (e) => this.onState(e.from, e.to));
  }

  setFloor(floor: Floor | null, spawnTile?: { gx: number; gz: number }): void {
    this.floor = floor;
    this.fsm.reset();
    this.hearing.reset();
    this.dyingPlayer = false;
    if (floor && spawnTile) {
      this.tileX = spawnTile.gx;
      this.tileZ = spawnTile.gz;
      this.worldPos.set(spawnTile.gx * TILE_SIZE, 0, spawnTile.gz * TILE_SIZE);
      this.group.position.copy(this.worldPos);
      this.moveT = 1;
    } else if (floor && floor.tiles.length) {
      // Pick the tile farthest from spawn as a sane default.
      const sp = floor.spawnPoint;
      let best = floor.tiles[0];
      let bestD = -1;
      for (const t of floor.tiles) {
        const d = Math.hypot(t.gx * TILE_SIZE - sp.x, t.gz * TILE_SIZE - sp.z);
        if (d > bestD) {
          bestD = d;
          best = t;
        }
      }
      this.tileX = best.gx;
      this.tileZ = best.gz;
      this.worldPos.set(best.gx * TILE_SIZE, 0, best.gz * TILE_SIZE);
      this.group.position.copy(this.worldPos);
      this.moveT = 1;
    }
  }

  forceHunt(): void {
    this.fsm.forceHunt();
  }

  isVisibleFrom(camera: Camera): boolean {
    if (!this.group.visible) return false;
    this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen);
    SCRATCH_A.copy(this.worldPos);
    SCRATCH_A.y = 1.5;
    return this.frustum.containsPoint(SCRATCH_A);
  }

  update(dt: number, playerPos: Vector3, camera: Camera): void {
    this.elapsed += dt;
    this.hearing.decay(dt);
    const sinceNoise = this.elapsed - this.hearing.lastNoiseAt;
    this.fsm.step(this.hearing.alertness, sinceNoise);

    // Always interpolate position
    if (this.moveT < 1) {
      this.moveT = Math.min(1, this.moveT + dt / this.moveDur);
      this.worldPos.lerpVectors(this.moveFrom, this.moveTo, easeInOut(this.moveT));
      this.group.position.copy(this.worldPos);
      // Face the direction of travel
      const dir = SCRATCH_A.copy(this.moveTo).sub(this.moveFrom);
      if (dir.lengthSq() > 1e-4) {
        const yaw = Math.atan2(dir.x, dir.z);
        this.mesh.rotation.y = yaw;
      }
    }

    // Movement scheduling
    if (this.fsm.state === "Alerted" || this.fsm.state === "Hunting") {
      this.nextStepIn -= dt;
      if (this.nextStepIn <= 0 && this.moveT >= 1) {
        const dur = this.fsm.state === "Hunting" ? HUNTING_STEP_SECS : ALERTED_STEP_SECS;
        this.tryStepToward(playerPos, camera, dur);
        this.nextStepIn = dur;
      }
    } else {
      this.nextStepIn = this.fsm.state === "Stirring" ? 4 : ALERTED_STEP_SECS;
    }

    // Face the player while hunting
    if (this.fsm.state === "Hunting" && this.moveT >= 1) {
      const dx = playerPos.x - this.worldPos.x;
      const dz = playerPos.z - this.worldPos.z;
      this.mesh.rotation.y = Math.atan2(dx, dz);
    }

    // Periodic scrape audio in non-Dormant states
    if (this.fsm.state === "Stirring" || this.fsm.state === "Alerted") {
      this.nextScrapeIn -= dt;
      if (this.nextScrapeIn <= 0) {
        this.nextScrapeIn = 2 + Math.random() * 3;
        this.bus.emit("noise.emitted", {
          pos: this.worldPos.clone(),
          radius: 0,
          intensity: 0,
          kind: "scrape",
        });
      }
    } else {
      this.nextScrapeIn = 2.5;
    }

    // Kill check
    if (
      this.fsm.state === "Hunting" &&
      !this.dyingPlayer &&
      this.elapsed - this.lastDeathAt > 5 &&
      this.worldPos.distanceTo(playerPos) < KILL_DISTANCE
    ) {
      this.dyingPlayer = true;
      this.lastDeathAt = this.elapsed;
      this.bus.emit("player.died", { pos: playerPos.clone() });
    }
  }

  /**
   * Pick an adjacent tile preferring the direction toward the last noise (or
   * the player when Hunting). When Alerted, prefer tiles outside player FOV.
   */
  private tryStepToward(playerPos: Vector3, camera: Camera, dur: number): void {
    if (!this.floor) return;
    const target = this.fsm.state === "Hunting"
      ? { x: playerPos.x, z: playerPos.z }
      : this.hearing.lastNoisePos ?? { x: playerPos.x, z: playerPos.z };

    // Compute desired direction in tile space
    const dx = target.x - this.tileX * TILE_SIZE;
    const dz = target.z - this.tileZ * TILE_SIZE;

    const candidates: { gx: number; gz: number; score: number }[] = [];
    const adjacents = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
    ];
    for (const [adx, adz] of adjacents) {
      const gx = this.tileX + adx;
      const gz = this.tileZ + adz;
      const tile = this.floor.tiles.find((t) => t.gx === gx && t.gz === gz);
      if (!tile) continue;
      // Score: dot(direction, target) — higher is better
      const score = adx * Math.sign(dx) + adz * Math.sign(dz);
      candidates.push({ gx, gz, score });
    }
    if (candidates.length === 0) return;

    // For Alerted, filter out candidates currently in player's frustum.
    if (this.fsm.state === "Alerted") {
      this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projScreen);
      const offscreen = candidates.filter((c) => {
        SCRATCH_B.set(c.gx * TILE_SIZE, 1.0, c.gz * TILE_SIZE);
        return !this.frustum.containsPoint(SCRATCH_B);
      });
      if (offscreen.length > 0) candidates.length = 0, candidates.push(...offscreen);
    }

    candidates.sort((a, b) => b.score - a.score);
    const next = candidates[0];

    this.tileX = next.gx;
    this.tileZ = next.gz;
    this.moveFrom.copy(this.worldPos);
    this.moveTo.set(next.gx * TILE_SIZE, 0, next.gz * TILE_SIZE);
    this.moveT = 0;
    this.moveDur = dur;
  }

  private onState(_from: ThreatState, to: ThreatState): void {
    // Visibility: hidden in Dormant; faded in Stirring; full in Alerted+
    if (to === "Dormant") {
      this.group.visible = false;
      this.dyingPlayer = false;
    } else {
      this.group.visible = true;
      const opaque = to === "Hunting" ? 1.0 : to === "Alerted" ? 0.95 : 0.6;
      this.eyesL.scale.setScalar(opaque);
      this.eyesR.scale.setScalar(opaque);
    }
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
