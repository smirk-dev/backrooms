import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PointLight, Vector3 } from "three";

const FRAME_COLOR = 0xc89858;
const FRAME_EMISSIVE = 0x6a4418;

/**
 * Visual indicator for "the way to the next floor." A doorway-shaped emissive
 * frame planted at the exit zone, plus a warm point light. Bloom amplifies the
 * frame so it's visible through fog from far away — wayfinding without a HUD.
 */
export class ExitMarker {
  readonly object: Group;
  private mat: MeshStandardMaterial;
  private light: PointLight;
  private elapsed = 0;

  constructor(pos: Vector3) {
    this.object = new Group();
    this.object.position.copy(pos);
    this.object.position.y = 0;

    this.mat = new MeshStandardMaterial({
      color: FRAME_COLOR,
      emissive: FRAME_EMISSIVE,
      emissiveIntensity: 0.55,
      roughness: 0.6,
    });

    // Two short vertical posts only — no header, no floor pad. Reads as a
    // threshold rather than a beacon. Just enough that you notice it's there
    // when your flashlight finds it, easy to miss otherwise.
    const postH = 0.85;
    const width = 0.85;
    const thickness = 0.05;
    const left = new Mesh(new BoxGeometry(thickness, postH, thickness), this.mat);
    left.position.set(-width / 2, postH / 2, 0);
    const right = new Mesh(new BoxGeometry(thickness, postH, thickness), this.mat);
    right.position.set(width / 2, postH / 2, 0);
    this.object.add(left, right);

    // A small floor stripe between the posts — the kind of detail a tired eye
    // might mistake for trim until it pulses.
    const stripeMat = new MeshStandardMaterial({
      color: FRAME_COLOR,
      emissive: FRAME_EMISSIVE,
      emissiveIntensity: 0.4,
      roughness: 0.7,
    });
    const stripe = new Mesh(new BoxGeometry(width, 0.02, 0.06), stripeMat);
    stripe.position.y = 0.012;
    this.object.add(stripe);

    this.light = new PointLight(FRAME_COLOR, 0.7, 3.2, 1.6);
    this.light.position.set(0, postH * 0.7, 0);
    this.object.add(this.light);
  }

  tick(dt: number): void {
    this.elapsed += dt;
    // Slow shallow breath — closer to a tired ember than a beacon.
    const pulse = 0.94 + 0.06 * Math.sin(this.elapsed * 0.7);
    this.mat.emissiveIntensity = 0.55 * pulse;
    this.light.intensity = 0.7 * pulse;
  }

  dispose(): void {
    this.mat.dispose();
  }
}
