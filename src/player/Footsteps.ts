import { Vector3 } from "three";
import type { EventBus } from "../core/EventBus";

const STEP_WALK = 0.85; // meters between footstep events
const STEP_RUN = 1.05;

const NOISE_POS = new Vector3();

export class Footsteps {
  private accum = 0;
  private prev = new Vector3();

  constructor(private bus: EventBus, startPos: Vector3) {
    this.prev.copy(startPos);
  }

  update(curPos: Vector3, sprinting: boolean): void {
    const moved = curPos.distanceTo(this.prev);
    this.prev.copy(curPos);
    if (moved < 1e-4) {
      this.accum = 0;
      return;
    }
    this.accum += moved;
    const stride = sprinting ? STEP_RUN : STEP_WALK;
    while (this.accum >= stride) {
      this.accum -= stride;
      NOISE_POS.copy(curPos);
      this.bus.emit("noise.emitted", {
        pos: NOISE_POS.clone(),
        radius: sprinting ? 9 : 3.5,
        intensity: sprinting ? 0.7 : 0.25,
        kind: sprinting ? "run" : "footstep",
      });
    }
  }
}
