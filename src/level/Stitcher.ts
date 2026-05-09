import type { TileSpec } from "./Floor";
import type { DoorDir } from "./Tile";

interface StitcherOpts {
  seed: number;
  /** Target number of tiles. Stitcher stops when reached. */
  count: number;
  /** Max abs(grid coord) on either axis. */
  bounds: number;
  /** 0..1 — chance of opening an "extra" door even when no neighbor exists. Higher = more loops. */
  loopChance?: number;
}

const DIRS: DoorDir[] = ["N", "S", "E", "W"];
const OPP: Record<DoorDir, DoorDir> = { N: "S", S: "N", E: "W", W: "E" };
const STEP: Record<DoorDir, [number, number]> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  W: [-1, 0],
};

/**
 * Deterministic PRNG (mulberry32). Same seed always produces the same level.
 * Exposed as a tiny class so tests can inspect / reuse.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded socket-matching tile placement. BFS from origin; each new tile gets
 * doors that match any existing neighbor, plus optional new doors (loopChance)
 * for unfilled directions still inside bounds. Output is a `TileSpec[]` ready
 * to feed into `new Floor(...)`.
 *
 * Determinism: identical opts produce identical specs across runs and platforms.
 */
export function stitch(opts: StitcherOpts): TileSpec[] {
  const rng = mulberry32(opts.seed);
  const loopChance = opts.loopChance ?? 0.32;
  const grid = new Map<string, TileSpec>();
  const queue: [number, number][] = [[0, 0]];
  const key = (x: number, z: number) => `${x},${z}`;

  // Seed the origin with at least one door to encourage growth.
  const startDoors: DoorDir[] = [DIRS[Math.floor(rng() * 4)]];
  grid.set(key(0, 0), { gx: 0, gz: 0, doors: startDoors, seed: (opts.seed ^ 0x9e3779b1) >>> 0 });

  let i = 0;
  while (queue.length && grid.size < opts.count && i++ < opts.count * 20) {
    const [x, z] = queue.shift()!;
    const spec = grid.get(key(x, z));
    if (!spec) continue;

    for (const d of DIRS) {
      if (!spec.doors.includes(d)) continue;
      const [dx, dz] = STEP[d];
      const nx = x + dx;
      const nz = z + dz;
      if (Math.abs(nx) > opts.bounds || Math.abs(nz) > opts.bounds) continue;
      const nk = key(nx, nz);
      let n = grid.get(nk);
      if (!n) {
        if (grid.size >= opts.count) continue;
        // Required door back toward (x,z)
        const required: DoorDir[] = [OPP[d]];
        // Chance to open additional doors (creates loops + branches)
        for (const od of DIRS) {
          if (od === OPP[d]) continue;
          const [ox, oz] = STEP[od];
          const tx = nx + ox;
          const tz = nz + oz;
          if (Math.abs(tx) > opts.bounds || Math.abs(tz) > opts.bounds) continue;
          const existing = grid.get(key(tx, tz));
          if (existing) {
            // If existing tile already has door pointing at us, we must mirror it.
            if (existing.doors.includes(OPP[od])) required.push(od);
          } else {
            // No neighbor yet — decide by loop chance whether to extend.
            if (rng() < loopChance) required.push(od);
          }
        }
        n = {
          gx: nx,
          gz: nz,
          doors: required,
          seed: (opts.seed ^ ((nx * 73856093) ^ (nz * 19349663))) >>> 0,
        };
        grid.set(nk, n);
        queue.push([nx, nz]);
      } else {
        // Existing neighbor must mirror the door we're opening into it.
        if (!n.doors.includes(OPP[d])) n.doors.push(OPP[d]);
      }
    }
  }

  return Array.from(grid.values());
}
