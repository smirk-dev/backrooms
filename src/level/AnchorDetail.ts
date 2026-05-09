import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Vector3,
  CylinderGeometry,
} from "three";

export type AnchorKind = "chair" | "poster" | "phone" | "lamp" | "shoe";

const PICKUP_DISTANCE = 1.0;

/**
 * Sparse, authored "anchor" detail in a tile. When the player approaches it,
 * the anchor fades out and grants a small sanity recovery. The shape and color
 * are chosen so each anchor reads as a *specific* object, not a placeholder —
 * the dread of liminal space is broken by tangible specifics.
 */
export class AnchorDetail {
  readonly object: Group;
  readonly pos: Vector3;
  consumed = false;
  private opacityT = 1;
  private mats: MeshStandardMaterial[] = [];
  private light?: PointLight;

  constructor(pos: Vector3, public readonly kind: AnchorKind) {
    this.pos = pos.clone();
    this.object = new Group();
    this.object.position.copy(pos);

    switch (kind) {
      case "chair":
        this.buildChair();
        break;
      case "poster":
        this.buildPoster();
        break;
      case "phone":
        this.buildPhone();
        break;
      case "lamp":
        this.buildLamp();
        break;
      case "shoe":
        this.buildShoe();
        break;
    }
  }

  private buildChair(): void {
    const wood = new MeshStandardMaterial({ color: 0x442a18, roughness: 0.85 });
    this.mats.push(wood);
    const seat = new Mesh(new BoxGeometry(0.5, 0.06, 0.5), wood);
    seat.position.y = 0.45;
    this.object.add(seat);
    const back = new Mesh(new BoxGeometry(0.5, 0.55, 0.06), wood);
    back.position.set(0, 0.75, -0.22);
    this.object.add(back);
    for (const [x, z] of [
      [-0.21, -0.21],
      [0.21, -0.21],
      [-0.21, 0.21],
      [0.21, 0.21],
    ]) {
      const leg = new Mesh(new BoxGeometry(0.06, 0.45, 0.06), wood);
      leg.position.set(x, 0.225, z);
      this.object.add(leg);
    }
    this.object.rotation.y = Math.random() * Math.PI;
  }

  private buildPoster(): void {
    const m = new MeshStandardMaterial({
      color: new Color(0xc8a070),
      emissive: new Color(0x4a3018),
      emissiveIntensity: 0.4,
      roughness: 0.8,
    });
    this.mats.push(m);
    const sheet = new Mesh(new BoxGeometry(0.6, 0.85, 0.02), m);
    sheet.position.y = 1.4;
    this.object.add(sheet);
  }

  private buildPhone(): void {
    const cradle = new MeshStandardMaterial({ color: 0x222020, roughness: 0.6 });
    const handset = new MeshStandardMaterial({
      color: 0x1a1818,
      emissive: 0x2a2218,
      emissiveIntensity: 0.4,
    });
    this.mats.push(cradle, handset);
    const base = new Mesh(new BoxGeometry(0.32, 0.08, 0.22), cradle);
    base.position.y = 0.04;
    const hs = new Mesh(new BoxGeometry(0.36, 0.08, 0.1), handset);
    hs.position.set(0, 0.12, 0.05);
    this.object.add(base, hs);
  }

  private buildLamp(): void {
    const pole = new MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6 });
    const shadeMat = new MeshStandardMaterial({
      color: 0xfff0c4,
      emissive: 0xffd078,
      emissiveIntensity: 1.4,
      roughness: 0.7,
    });
    this.mats.push(pole, shadeMat);
    const stand = new Mesh(new CylinderGeometry(0.04, 0.06, 1.4, 8), pole);
    stand.position.y = 0.7;
    const shade = new Mesh(new CylinderGeometry(0.18, 0.24, 0.28, 12), shadeMat);
    shade.position.y = 1.5;
    this.object.add(stand, shade);
    this.light = new PointLight(0xffd078, 1.6, 4, 1.5);
    this.light.position.y = 1.5;
    this.object.add(this.light);
  }

  private buildShoe(): void {
    const m = new MeshStandardMaterial({ color: 0x261a14, roughness: 0.95 });
    this.mats.push(m);
    const shoe = new Mesh(new BoxGeometry(0.28, 0.1, 0.12), m);
    shoe.position.y = 0.05;
    this.object.add(shoe);
    this.object.rotation.y = Math.random() * Math.PI;
  }

  /** Returns true when fade-out completes — caller should remove. */
  tick(dt: number, playerPos: Vector3): boolean {
    if (!this.consumed) {
      const d = playerPos.distanceTo(this.pos);
      if (d < PICKUP_DISTANCE) this.consumed = true;
      return false;
    }
    this.opacityT = Math.max(0, this.opacityT - dt * 1.4);
    for (const m of this.mats) {
      m.transparent = true;
      m.opacity = this.opacityT;
      m.emissiveIntensity = (m.userData.baseEmissive ?? m.emissiveIntensity) * this.opacityT;
    }
    if (this.light) this.light.intensity = 1.6 * this.opacityT;
    this.object.scale.setScalar(0.6 + 0.4 * this.opacityT);
    return this.opacityT <= 0.001;
  }

  dispose(): void {
    for (const m of this.mats) m.dispose();
  }
}
