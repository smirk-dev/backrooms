import { Group, Vector3 } from "three";
import { Marker } from "./Marker";
import type { EventBus } from "../core/EventBus";
import type { SanitySystem } from "../sanity/SanitySystem";

const MAX_MARKERS = 6;
const REAL_LIFETIME = 600; // 10 minutes
const GHOST_LIFETIME = 30; // ghosts are short-lived
const GHOST_TRIGGER_BELOW = 0.4;
const GHOST_INTERVAL = 30; // seconds between ghosts at low sanity
const PLACEMENT_NOISE_RADIUS = 6;
const PLACEMENT_NOISE_INTENSITY = 0.6;

/**
 * Player can place up to MAX_MARKERS real markers. Each fades over REAL_LIFETIME.
 * When sanity < GHOST_TRIGGER_BELOW, ghost markers spawn periodically in already-
 * visited tiles. They look identical and despawn silently if approached.
 */
export class MarkerSystem {
  readonly group: Group;
  private real: Marker[] = [];
  private ghosts: Marker[] = [];
  private lastGhostAt = 0;
  private remaining = MAX_MARKERS;

  constructor(private bus: EventBus, private sanity: SanitySystem) {
    this.group = new Group();
  }

  get available(): number {
    return this.remaining;
  }

  tryPlace(pos: Vector3): boolean {
    if (this.remaining <= 0) return false;
    const m = new Marker(pos, false);
    this.real.push(m);
    this.group.add(m.object);
    this.remaining--;
    this.bus.emit("marker.placed", { pos: pos.clone(), isGhost: false });
    this.bus.emit("noise.emitted", {
      pos: pos.clone(),
      radius: PLACEMENT_NOISE_RADIUS,
      intensity: PLACEMENT_NOISE_INTENSITY,
      kind: "marker",
    });
    return true;
  }

  update(dt: number, elapsed: number, playerPos: Vector3, visitedTiles: Iterable<string>): void {
    // Tick real markers
    for (let i = this.real.length - 1; i >= 0; i--) {
      const m = this.real[i];
      if (!m.tick(dt, REAL_LIFETIME)) {
        this.group.remove(m.object);
        m.dispose();
        this.real.splice(i, 1);
        this.remaining = Math.min(MAX_MARKERS, this.remaining + 1);
      }
    }

    // Tick ghosts and despawn if player approaches
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      const close = g.pos.distanceTo(playerPos) < 0.6;
      const expired = !g.tick(dt, GHOST_LIFETIME);
      if (close || expired) {
        this.group.remove(g.object);
        g.dispose();
        this.ghosts.splice(i, 1);
      }
    }

    // Maybe spawn a ghost
    if (this.sanity.value < GHOST_TRIGGER_BELOW && elapsed - this.lastGhostAt > GHOST_INTERVAL) {
      this.lastGhostAt = elapsed;
      const ghostPos = pickGhostPos(visitedTiles, playerPos);
      if (ghostPos) {
        const g = new Marker(ghostPos, true);
        this.ghosts.push(g);
        this.group.add(g.object);
      }
    }
  }
}

function pickGhostPos(visited: Iterable<string>, playerPos: Vector3): Vector3 | null {
  const ids = Array.from(visited);
  if (ids.length === 0) return null;
  // Pick random visited tile that's not the one the player is currently in.
  const TILE_SIZE = 8;
  const playerTile = `tile_${Math.round(playerPos.x / TILE_SIZE)}_${Math.round(
    playerPos.z / TILE_SIZE
  )}`;
  const candidates = ids.filter((id) => id !== playerTile);
  if (candidates.length === 0) return null;
  const id = candidates[Math.floor(Math.random() * candidates.length)];
  const m = id.match(/^tile_(-?\d+)_(-?\d+)$/);
  if (!m) return null;
  const gx = parseInt(m[1], 10);
  const gz = parseInt(m[2], 10);
  // Random spot inside the tile, not against a wall
  const jx = (Math.random() - 0.5) * 5;
  const jz = (Math.random() - 0.5) * 5;
  return new Vector3(gx * TILE_SIZE + jx, 0, gz * TILE_SIZE + jz);
}
