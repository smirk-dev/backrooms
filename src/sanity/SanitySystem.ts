import { Vector3 } from "three";
import type { EventBus } from "../core/EventBus";

const DECAY_BASE_SEEN = 0.002;
const DECAY_SPRINT = 0.01;
const DECAY_DARK = 0.005;
const DECAY_THREAT_SEEN = 0.05;

const RECOVERY_NOVEL_TILE = 0.15;
const RECOVERY_ANCHOR = 0.05;

const PHANTOM_INTERVAL_MIN = 7;
const PHANTOM_INTERVAL_MAX = 14;

const PHANTOM_POS = new Vector3();

export interface SanityContext {
  flashlightOn: boolean;
  sprinting: boolean;
  threatVisible: boolean;
  inNovelTile: boolean; // resolved externally per-frame? we'll use events instead
}

/**
 * Sanity is a single float in [0,1]. Decay/recovery driven by per-frame context
 * + event listeners. The system never directly modifies the renderer — it only
 * emits `sanity.changed` and exposes `value` for the Composer to read.
 */
export class SanitySystem {
  value = 1.0;
  /** Lowest value observed since last `resetMin()` — used for end-of-run branching. */
  minObserved = 1.0;
  /** When true, decay/recovery are ignored (used for finale "locked-low" state). */
  locked = false;
  private accumPhantom = 0;
  private nextPhantomIn: number;
  private moveSpeedFromPlayer = 0;

  constructor(private bus: EventBus) {
    this.nextPhantomIn = randRange(PHANTOM_INTERVAL_MIN, PHANTOM_INTERVAL_MAX);

    this.bus.on("tile.entered", (e) => {
      if (e.novel) this.adjust(+RECOVERY_NOVEL_TILE);
    });
  }

  /** Recovery emitted by anchor pickups / interactables. */
  grantAnchor(): void {
    this.adjust(+RECOVERY_ANCHOR);
  }

  /** Called by the player each frame so we know its movement state for phantom placement. */
  reportPlayerSpeed(speed: number): void {
    this.moveSpeedFromPlayer = speed;
  }

  update(
    dt: number,
    ctx: { flashlightOn: boolean; sprinting: boolean; threatVisible: boolean; playerPos: Vector3; cameraForward: Vector3 }
  ): void {
    let decay = DECAY_BASE_SEEN;
    if (!ctx.flashlightOn) decay += DECAY_DARK;
    if (ctx.sprinting) decay += DECAY_SPRINT;
    if (ctx.threatVisible) decay += DECAY_THREAT_SEEN;
    if (decay > 0) this.adjust(-decay * dt);

    // Phantom footsteps: only at low sanity.
    if (this.value < 0.3) {
      this.accumPhantom += dt;
      if (this.accumPhantom >= this.nextPhantomIn) {
        this.accumPhantom = 0;
        this.nextPhantomIn = randRange(PHANTOM_INTERVAL_MIN, PHANTOM_INTERVAL_MAX) * (0.5 + this.value);
        // Place phantom 2.5–4m behind the player along (-cameraForward) ± slight jitter.
        const dist = 2.5 + Math.random() * 1.5;
        PHANTOM_POS.copy(ctx.cameraForward).normalize().multiplyScalar(-dist);
        PHANTOM_POS.add(ctx.playerPos);
        // Y at ankle height
        PHANTOM_POS.y = ctx.playerPos.y + 0.1;
        this.bus.emit("noise.emitted", {
          pos: PHANTOM_POS.clone(),
          radius: 0, // doesn't reach the threat — phantom flagged so Hearing ignores it
          intensity: 0,
          kind: "phantom",
        });
      }
    } else {
      this.accumPhantom = 0;
    }
    void this.moveSpeedFromPlayer;
  }

  /** Recommended FOV for the camera, given current sanity (drift). */
  fovTarget(elapsed: number, baseFov = 74): number {
    const decay = 1 - this.value;
    // Cheap perlin-ish: sum of two sines.
    const noise =
      Math.sin(elapsed * 0.27) * 0.6 + Math.sin(elapsed * 0.61 + 1.7) * 0.4;
    return baseFov + noise * decay * 4.5;
  }

  /** Mutate value, clamp to [0,1], emit event when meaningfully changed. */
  adjust(delta: number): void {
    if (delta === 0 || this.locked) return;
    const before = this.value;
    this.value = Math.max(0, Math.min(1, this.value + delta));
    const realDelta = this.value - before;
    if (realDelta === 0) return;
    if (this.value < this.minObserved) this.minObserved = this.value;
    this.bus.emit("sanity.changed", { value: this.value, delta: realDelta });
  }

  /** Force a specific value; used by the finale to lock sanity low. */
  set(value: number): void {
    const v = Math.max(0, Math.min(1, value));
    const delta = v - this.value;
    this.value = v;
    if (v < this.minObserved) this.minObserved = v;
    this.bus.emit("sanity.changed", { value: v, delta });
  }

  resetForNewRun(): void {
    this.value = 1;
    this.minObserved = 1;
    this.locked = false;
  }
}

function randRange(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
