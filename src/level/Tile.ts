import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Box3,
  Vector3,
} from "three";
import type { Theme } from "./Theme";
import { THEMES } from "./Theme";

export type DoorDir = "N" | "S" | "E" | "W";

export const TILE_SIZE = 8;
export const CEILING_H = 3.0;
export const DOOR_WIDTH = 1.7;
export const DOOR_HEIGHT = 2.15;
export const WALL_THICKNESS = 0.18;

interface TileOpts {
  doors: DoorDir[];
  theme?: Theme;
  /** Used for subtle per-tile variance (lamp jitter). */
  seed?: number;
}

/**
 * One 8x8 room with optional door openings on its 4 walls.
 * Returns a Group ready to be added to the scene plus the AABB list for collision.
 */
export class Tile {
  readonly group: Group;
  readonly colliders: Box3[] = [];
  readonly id: string;
  readonly theme: Theme;
  readonly doors: DoorDir[];
  /** Used by SeamTricks.shifting to swap geometry. */
  readonly mainMeshes: Mesh[] = [];

  constructor(public readonly gx: number, public readonly gz: number, opts: TileOpts) {
    this.id = `tile_${gx}_${gz}`;
    this.theme = opts.theme ?? THEMES.lobby;
    this.doors = opts.doors;
    this.group = new Group();
    this.group.name = this.id;
    this.group.position.set(gx * TILE_SIZE, 0, gz * TILE_SIZE);

    this.buildFloor();
    this.buildCeiling();
    this.buildWalls(opts.doors);
    this.buildLight(opts.seed ?? 0);
    if (this.theme.flooded) this.buildWater();
  }

  private buildFloor(): void {
    const m = new MeshStandardMaterial({
      color: this.theme.carpet,
      roughness: this.theme.hasCarpet ? 0.95 : 0.7,
      metalness: 0.0,
    });
    const g = new PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const mesh = new Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildCeiling(): void {
    if (this.theme.industrial) {
      // Darker, slightly broken-up ceiling for garage feel
      const m = new MeshStandardMaterial({ color: this.theme.ceiling, roughness: 0.95 });
      const g = new PlaneGeometry(TILE_SIZE, TILE_SIZE);
      const mesh = new Mesh(g, m);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = CEILING_H + 0.4; // higher ceiling for garages
      this.group.add(mesh);
      return;
    }
    const m = new MeshStandardMaterial({ color: this.theme.ceiling, roughness: 0.85 });
    const g = new PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const mesh = new Mesh(g, m);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = CEILING_H;
    this.group.add(mesh);
  }

  private buildWater(): void {
    const m = new MeshStandardMaterial({
      color: 0x2a4044,
      roughness: 0.18,
      metalness: 0.4,
      transparent: true,
      opacity: 0.55,
    });
    const g = new PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const mesh = new Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.04;
    this.group.add(mesh);
  }

  private buildWalls(doors: DoorDir[]): void {
    const half = TILE_SIZE / 2;
    const offsets: Record<DoorDir, { ax: "x" | "z"; sign: number }> = {
      N: { ax: "z", sign: -1 },
      S: { ax: "z", sign: 1 },
      E: { ax: "x", sign: 1 },
      W: { ax: "x", sign: -1 },
    };

    for (const dir of ["N", "S", "E", "W"] as DoorDir[]) {
      const o = offsets[dir];
      const hasDoor = doors.includes(dir);
      const along = o.ax === "x" ? "z" : "x";
      const wallY = CEILING_H / 2;
      const basePerp = o.sign * (half - WALL_THICKNESS / 2);

      if (!hasDoor) {
        this.addWallSegment(o.ax, basePerp, along, 0, TILE_SIZE, CEILING_H, wallY);
      } else {
        const sideLen = (TILE_SIZE - DOOR_WIDTH) / 2;
        const headerH = CEILING_H - DOOR_HEIGHT;
        const headerY = DOOR_HEIGHT + headerH / 2;
        this.addWallSegment(o.ax, basePerp, along, -half + sideLen / 2, sideLen, CEILING_H, wallY);
        this.addWallSegment(o.ax, basePerp, along, half - sideLen / 2, sideLen, CEILING_H, wallY);
        this.addWallSegment(o.ax, basePerp, along, 0, DOOR_WIDTH, headerH, headerY);
      }
    }
  }

  private addWallSegment(
    perpAxis: "x" | "z",
    perpPos: number,
    alongAxis: "x" | "z",
    alongPos: number,
    length: number,
    height: number,
    yCenter: number
  ): void {
    const sx = perpAxis === "x" ? WALL_THICKNESS : alongAxis === "x" ? length : WALL_THICKNESS;
    const sy = height;
    const sz = perpAxis === "z" ? WALL_THICKNESS : alongAxis === "z" ? length : WALL_THICKNESS;

    const m = new MeshStandardMaterial({ color: this.theme.wallpaper, roughness: 0.92 });
    const trimMat = new MeshStandardMaterial({ color: this.theme.trim, roughness: 0.88 });

    const g = new BoxGeometry(sx, sy, sz);
    const mesh = new Mesh(g, m);

    let cx = 0;
    let cz = 0;
    if (perpAxis === "x") {
      cx = perpPos;
      cz = alongAxis === "z" ? alongPos : 0;
    } else {
      cz = perpPos;
      cx = alongAxis === "x" ? alongPos : 0;
    }
    mesh.position.set(cx, yCenter, cz);
    this.group.add(mesh);
    this.mainMeshes.push(mesh);

    if (yCenter < CEILING_H * 0.6 && this.theme.hasCarpet) {
      const trimG = new BoxGeometry(sx * 1.02, 0.12, sz * 1.02);
      const trim = new Mesh(trimG, trimMat);
      trim.position.set(cx, 0.06, cz);
      this.group.add(trim);
    }

    const worldX = this.gx * TILE_SIZE + cx;
    const worldZ = this.gz * TILE_SIZE + cz;
    const min = new Vector3(worldX - sx / 2, yCenter - sy / 2, worldZ - sz / 2);
    const max = new Vector3(worldX + sx / 2, yCenter + sy / 2, worldZ + sz / 2);
    this.colliders.push(new Box3(min, max));
  }

  private buildLight(seed: number): void {
    const fix = new Mesh(
      new BoxGeometry(1.6, 0.06, 0.45),
      new MeshStandardMaterial({
        color: this.theme.fixture,
        emissive: this.theme.fixture,
        emissiveIntensity: this.theme.fixtureEmissive,
      })
    );
    fix.position.set(0, (this.theme.industrial ? CEILING_H + 0.4 : CEILING_H) - 0.05, 0);
    this.group.add(fix);

    const jitterX = (seed % 7) * 0.06 - 0.18;
    const jitterZ = ((seed * 13) % 5) * 0.07 - 0.14;
    const intensity = this.theme.industrial ? 3.5 : 6.5;
    const range = this.theme.industrial ? 9 : 11;
    const pl = new PointLight(this.theme.fixture, intensity, range, 1.6);
    pl.position.set(jitterX, (this.theme.industrial ? CEILING_H + 0.2 : CEILING_H - 0.2), jitterZ);
    this.group.add(pl);
  }

  centerWorld(out: Vector3): Vector3 {
    return out.set(this.gx * TILE_SIZE, 0, this.gz * TILE_SIZE);
  }
}
