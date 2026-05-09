import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PointLight, Vector3 } from "three";

const FRAME_COLOR = 0xffd070;
const FRAME_EMISSIVE = 0xffaa30;

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
      emissiveIntensity: 2.4,
      roughness: 0.3,
    });

    // Two vertical posts + one header → reads as a doorway frame
    const postH = 2.2;
    const width = 1.0;
    const thickness = 0.08;
    const left = new Mesh(new BoxGeometry(thickness, postH, thickness), this.mat);
    left.position.set(-width / 2, postH / 2, 0);
    const right = new Mesh(new BoxGeometry(thickness, postH, thickness), this.mat);
    right.position.set(width / 2, postH / 2, 0);
    const top = new Mesh(new BoxGeometry(width + thickness, thickness, thickness), this.mat);
    top.position.set(0, postH, 0);
    this.object.add(left, right, top);

    // Floor pad to anchor the marker to the ground
    const padMat = new MeshStandardMaterial({
      color: FRAME_COLOR,
      emissive: FRAME_EMISSIVE,
      emissiveIntensity: 1.4,
      roughness: 0.6,
    });
    const pad = new Mesh(new BoxGeometry(width + 0.4, 0.04, 0.5), padMat);
    pad.position.y = 0.02;
    this.object.add(pad);

    this.light = new PointLight(FRAME_COLOR, 4.0, 9, 1.4);
    this.light.position.set(0, postH * 0.9, 0);
    this.object.add(this.light);
  }

  tick(dt: number): void {
    this.elapsed += dt;
    // Subtle pulse — never frantic, always patient.
    const pulse = 0.85 + 0.15 * Math.sin(this.elapsed * 1.6);
    this.mat.emissiveIntensity = 2.4 * pulse;
    this.light.intensity = 4.0 * pulse;
  }

  dispose(): void {
    this.mat.dispose();
  }
}
