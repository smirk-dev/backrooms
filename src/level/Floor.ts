import { Group, Vector3, Box3 } from "three";
import { Tile, TILE_SIZE } from "./Tile";
import type { DoorDir } from "./Tile";
import { THEMES } from "./Theme";
import type { Theme } from "./Theme";
import type { EventBus } from "../core/EventBus";
import type { AnchorDetail } from "./AnchorDetail";

export interface TileSpec {
  gx: number;
  gz: number;
  doors: DoorDir[];
  seed?: number;
}

/**
 * A floor is a small set of themed tiles. Hand-authored or produced by Stitcher.
 */
export class Floor {
  readonly group: Group;
  readonly tiles: Tile[];
  readonly colliders: Box3[];
  readonly visited = new Set<string>();
  readonly theme: Theme;
  readonly anchors: AnchorDetail[] = [];
  spawnPoint = new Vector3(0, 0, 0);
  /** Optional ID for FloorManager / save state. */
  id = "lobby";

  private currentTileId: string | null = null;

  constructor(specs: TileSpec[], private bus: EventBus, theme: Theme = THEMES.lobby) {
    this.theme = theme;
    this.group = new Group();
    this.tiles = specs.map((s) => new Tile(s.gx, s.gz, { doors: s.doors, seed: s.seed, theme }));
    this.colliders = [];
    for (const t of this.tiles) {
      this.group.add(t.group);
      this.colliders.push(...t.colliders);
    }
  }

  tileAt(worldX: number, worldZ: number): Tile | null {
    const gx = Math.round(worldX / TILE_SIZE);
    const gz = Math.round(worldZ / TILE_SIZE);
    return this.tiles.find((t) => t.gx === gx && t.gz === gz) ?? null;
  }

  update(playerPos: Vector3): void {
    const t = this.tileAt(playerPos.x, playerPos.z);
    if (!t) return;
    if (t.id === this.currentTileId) return;
    this.currentTileId = t.id;
    const novel = !this.visited.has(t.id);
    if (novel) this.visited.add(t.id);
    this.bus.emit("tile.entered", { id: t.id, novel });
  }

  /** Tile id where the player currently stands. */
  currentTile(): string | null {
    return this.currentTileId;
  }

  addAnchor(a: AnchorDetail): void {
    this.anchors.push(a);
    this.group.add(a.object);
  }
}
