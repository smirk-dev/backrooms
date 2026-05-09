import { Box3, Vector3 } from "three";
import { Floor } from "../Floor";
import { Tile, TILE_SIZE } from "../Tile";
import { THEMES } from "../Theme";
import { stitch } from "../Stitcher";
import { AnchorDetail } from "../AnchorDetail";
import type { EventBus } from "../../core/EventBus";
import type { FloorBundle } from "../FloorManager";

/**
 * Floor 1 — Offices. Stitched layout (~14 tiles) under the offices palette.
 * Introduces a one-way looped corridor: entering a trigger near the south
 * boundary blink-teleports the player to the equivalent X coord at the north
 * boundary — the corridor *feels* endless.
 *
 * Threat is dormant on this floor (no scripted hunt). Two authored anchors
 * (phone, lamp) reward exploration with sanity recovery.
 */
export function buildOfficesFloor(bus: EventBus): FloorBundle {
  const specs = stitch({ seed: 4711, count: 14, bounds: 3, loopChance: 0.42 });
  const floor = new Floor(specs, bus, THEMES.offices);
  floor.id = "offices";
  floor.spawnPoint = new Vector3(0, 0, 0);

  // Find a "long" tile pair (same z, large x distance) for the looped corridor
  let loopA: Tile | null = null;
  let loopB: Tile | null = null;
  let bestLen = 0;
  for (const a of floor.tiles) {
    for (const b of floor.tiles) {
      if (a === b) continue;
      if (a.gz !== b.gz) continue;
      const d = Math.abs(a.gx - b.gx);
      if (d > bestLen) {
        bestLen = d;
        loopA = a;
        loopB = b;
      }
    }
  }
  const triggers: FloorBundle["triggers"] = [];
  if (loopA && loopB && bestLen >= 2) {
    // One-way: entering near loopB returns the player to a point just past loopA
    const aPos = new Vector3(loopA.gx * TILE_SIZE, 0, loopA.gz * TILE_SIZE);
    const bPos = new Vector3(loopB.gx * TILE_SIZE, 0, loopB.gz * TILE_SIZE);
    const dir = Math.sign(bPos.x - aPos.x);
    const trigCenter = bPos.clone();
    trigCenter.x -= dir * 1.2; // just before exit edge of B
    const trigMin = new Vector3(trigCenter.x - 0.4, 0, trigCenter.z - 1.2);
    const trigMax = new Vector3(trigCenter.x + 0.4, 3, trigCenter.z + 1.2);
    // Destination: just inside A on the same heading
    const dest = aPos.clone();
    dest.x += dir * 1.2;
    triggers.push({
      bounds: new Box3(trigMin, trigMax),
      onEnter: (playerPos) => {
        playerPos.copy(dest);
      },
    });
  }

  // Anchors: drop a phone and a lamp in tiles farthest from spawn
  const sortedByDist = [...floor.tiles].sort(
    (a, b) =>
      Math.hypot(b.gx, b.gz) - Math.hypot(a.gx, a.gz)
  );
  const anchorTiles = sortedByDist.slice(0, 3);
  const kinds: ("phone" | "lamp" | "shoe")[] = ["phone", "lamp", "shoe"];
  for (let i = 0; i < anchorTiles.length; i++) {
    const t = anchorTiles[i];
    const ax = t.gx * TILE_SIZE + (Math.random() - 0.5) * 4;
    const az = t.gz * TILE_SIZE + (Math.random() - 0.5) * 4;
    floor.addAnchor(new AnchorDetail(new Vector3(ax, 0, az), kinds[i]));
  }

  // Exit trigger at the farthest tile from origin
  const exit = sortedByDist[0];
  const exMin = new Vector3(exit.gx * TILE_SIZE - 1.5, 0, exit.gz * TILE_SIZE - 1.5);
  const exMax = new Vector3(exit.gx * TILE_SIZE + 1.5, 3, exit.gz * TILE_SIZE + 1.5);

  return {
    floor,
    triggers,
    exits: [{ bounds: new Box3(exMin, exMax), nextFloor: "garage" }],
    threatSpawn: anchorTiles[anchorTiles.length - 1]
      ? { gx: anchorTiles[anchorTiles.length - 1].gx, gz: anchorTiles[anchorTiles.length - 1].gz }
      : undefined,
  };
}
