import { BoxGeometry, Mesh, MeshStandardMaterial, PointLight, Vector3, Object3D } from "three";

export class Marker {
  readonly object: Object3D;
  private mesh: Mesh;
  private mat: MeshStandardMaterial;
  private light: PointLight;
  age = 0;
  readonly pos: Vector3;

  constructor(pos: Vector3, public readonly isGhost: boolean) {
    this.pos = pos.clone();
    this.object = new Object3D();
    this.object.position.copy(pos);
    this.object.position.y = 0.06;

    this.mat = new MeshStandardMaterial({
      color: isGhost ? 0xb09060 : 0xf0d480,
      emissive: isGhost ? 0x553a18 : 0xc89844,
      emissiveIntensity: isGhost ? 1.6 : 2.6,
      roughness: 0.4,
    });
    this.mesh = new Mesh(new BoxGeometry(0.12, 0.12, 0.12), this.mat);
    this.object.add(this.mesh);

    this.light = new PointLight(isGhost ? 0xa07840 : 0xffd070, 0.9, 2.6, 1.6);
    this.light.position.set(0, 0.18, 0);
    this.object.add(this.light);
  }

  /** Returns false when fully faded (caller should remove). */
  tick(dt: number, lifetime: number): boolean {
    this.age += dt;
    const t = Math.max(0, 1 - this.age / lifetime);
    this.mat.emissiveIntensity = (this.isGhost ? 1.6 : 2.6) * t;
    this.light.intensity = (this.isGhost ? 0.9 : 1.4) * t;
    this.object.scale.setScalar(0.85 + 0.15 * t);
    return this.age < lifetime;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
