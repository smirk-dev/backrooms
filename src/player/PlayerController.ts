import { Camera, Euler, MathUtils, Vector3 } from "three";
import type { Input } from "../core/Input";
import type { EventBus } from "../core/EventBus";
import { CapsuleCollider } from "./Collider";
import { Flashlight } from "./Flashlight";
import { Footsteps } from "./Footsteps";

const WALK_SPEED = 2.4; // m/s
const RUN_SPEED = 4.6; // m/s
const ACCEL = 26.0;
const FRICTION = 18.0;
const MOUSE_SENS = 0.0022;
const EYE_HEIGHT = 1.65;

const TMP_FORWARD = new Vector3();
const TMP_RIGHT = new Vector3();
const TMP_DESIRED = new Vector3();
const TMP_DELTA = new Vector3();

export class PlayerController {
  readonly position = new Vector3(0, 0, 0);
  readonly velocity = new Vector3();
  readonly euler = new Euler(0, 0, 0, "YXZ");
  readonly collider: CapsuleCollider;
  readonly flashlight: Flashlight;
  private footsteps: Footsteps;
  private fovBase = 74;
  private fovTarget = 74;

  constructor(
    private camera: Camera,
    private input: Input,
    private bus: EventBus,
    spawn: Vector3
  ) {
    this.position.copy(spawn);
    this.collider = new CapsuleCollider();
    this.flashlight = new Flashlight(bus);
    this.flashlight.attachTo(camera);
    this.footsteps = new Footsteps(bus, this.position);
  }

  setFovBase(fov: number): void {
    this.fovBase = fov;
  }

  /** Smoothly nudge fov target — used by SanitySystem for drift. */
  setFovTarget(fov: number): void {
    this.fovTarget = fov;
  }

  update(dt: number): void {
    // Mouse look
    if (this.input.pointerLocked) {
      this.euler.y -= this.input.mouseDX * MOUSE_SENS;
      this.euler.x -= this.input.mouseDY * MOUSE_SENS;
      this.euler.x = MathUtils.clamp(this.euler.x, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    }
    this.camera.quaternion.setFromEuler(this.euler);

    // Movement
    const ax = this.input.axes();
    const sprint = ax.sprint && (ax.x !== 0 || ax.z !== 0);
    const targetSpeed = sprint ? RUN_SPEED : WALK_SPEED;

    // Build forward/right on the XZ plane
    TMP_FORWARD.set(0, 0, -1).applyEuler(new Euler(0, this.euler.y, 0));
    TMP_RIGHT.set(1, 0, 0).applyEuler(new Euler(0, this.euler.y, 0));
    TMP_DESIRED.set(0, 0, 0).addScaledVector(TMP_FORWARD, -ax.z).addScaledVector(TMP_RIGHT, ax.x);
    if (TMP_DESIRED.lengthSq() > 1) TMP_DESIRED.normalize();
    TMP_DESIRED.multiplyScalar(targetSpeed);

    // Accelerate toward desired horizontal velocity
    const dvx = TMP_DESIRED.x - this.velocity.x;
    const dvz = TMP_DESIRED.z - this.velocity.z;
    const accelStep = ACCEL * dt;
    const dvLen = Math.hypot(dvx, dvz);
    if (dvLen > 1e-5) {
      const f = Math.min(1, accelStep / dvLen);
      this.velocity.x += dvx * f;
      this.velocity.z += dvz * f;
    }

    // Friction when no input
    if (ax.x === 0 && ax.z === 0) {
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (speed > 0) {
        const drop = Math.min(speed, FRICTION * dt);
        const k = (speed - drop) / speed;
        this.velocity.x *= k;
        this.velocity.z *= k;
      }
    }

    // Move with collision
    TMP_DELTA.set(this.velocity.x * dt, 0, this.velocity.z * dt);
    const contacted = this.collider.move(this.position, TMP_DELTA);
    if (contacted) {
      // Bumping into a wall is noisy and kills inertia.
      if (this.velocity.lengthSq() > 0.5) {
        this.bus.emit("noise.emitted", {
          pos: this.position.clone(),
          radius: 5,
          intensity: 0.5,
          kind: "bump",
        });
      }
      this.velocity.set(0, 0, 0);
    }

    // Camera position = player position + eye height
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);

    // FOV drift toward target
    if ("fov" in this.camera) {
      const c = this.camera as Camera & { fov: number; updateProjectionMatrix: () => void };
      const cur = c.fov;
      const next = MathUtils.lerp(cur, this.fovTarget, Math.min(1, dt * 2.5));
      if (Math.abs(next - cur) > 0.01) {
        c.fov = next;
        c.updateProjectionMatrix();
      }
    }

    // Footsteps emit noise events
    this.footsteps.update(this.position, sprint);

    // Flashlight toggle
    if (this.input.wasPressed("KeyF")) this.flashlight.toggle(this.position);

    // Reset to base fov target if external systems aren't pushing it (sanity will override)
    void this.fovBase;
  }
}
