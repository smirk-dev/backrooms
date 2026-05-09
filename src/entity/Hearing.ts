import type { Vector3 } from "three";
import type { EventBus } from "../core/EventBus";

const ALERT_DECAY = 0.04; // per second when no noise

/**
 * Subscribes to noise.emitted, accumulates an "alertness" float driven by:
 *   alertness += intensity * (1 - distance/radius)   if within radius
 * Phantom noises are ignored.
 *
 * Provides last-noise tile coords for the FSM to chase.
 */
export class Hearing {
  alertness = 0;
  lastNoisePos: { x: number; z: number } | null = null;
  lastNoiseAt = -Infinity;

  constructor(private bus: EventBus, private getEntityPos: () => Vector3, private getElapsed: () => number) {
    this.bus.on("noise.emitted", (n) => {
      if (n.kind === "phantom" || n.kind === "scrape") return;
      const ep = this.getEntityPos();
      const dx = n.pos.x - ep.x;
      const dz = n.pos.z - ep.z;
      const dist = Math.hypot(dx, dz);
      if (dist > n.radius) return;
      const t = 1 - dist / Math.max(0.001, n.radius);
      this.alertness = Math.min(1, this.alertness + n.intensity * t);
      this.lastNoisePos = { x: n.pos.x, z: n.pos.z };
      this.lastNoiseAt = this.getElapsed();
    });
  }

  decay(dt: number): void {
    if (this.alertness > 0) {
      this.alertness = Math.max(0, this.alertness - ALERT_DECAY * dt);
    }
  }

  reset(): void {
    this.alertness = 0;
    this.lastNoisePos = null;
    this.lastNoiseAt = -Infinity;
  }
}
