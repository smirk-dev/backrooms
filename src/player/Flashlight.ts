import { Object3D, SpotLight, Vector3 } from "three";
import type { EventBus } from "../core/EventBus";

const NOISE_POS = new Vector3();

export class Flashlight {
  readonly light: SpotLight;
  readonly target: Object3D;
  private _on = true;

  constructor(private bus: EventBus) {
    this.light = new SpotLight(
      0xfff1c2,
      18.0,
      14, // distance
      Math.PI * 0.16, // angle
      0.45, // penumbra
      1.4 // decay
    );
    this.light.position.set(0, 0, 0);
    this.target = new Object3D();
    this.target.position.set(0, 0, -1);
    this.light.target = this.target;
    this.applyState();
  }

  attachTo(camera: Object3D): void {
    camera.add(this.light);
    camera.add(this.target);
  }

  toggle(playerPos: Vector3): void {
    this._on = !this._on;
    this.applyState();
    NOISE_POS.copy(playerPos);
    this.bus.emit("noise.emitted", {
      pos: NOISE_POS.clone(),
      radius: 3.5,
      intensity: 0.35,
      kind: "flashlight",
    });
  }

  get on(): boolean {
    return this._on;
  }

  private applyState(): void {
    this.light.intensity = this._on ? 18.0 : 0.0;
  }
}
