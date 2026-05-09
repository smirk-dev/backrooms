import { Box3, MeshStandardMaterial, Vector3, type Mesh } from "three";
import { Floor } from "../Floor";
import { TILE_SIZE } from "../Tile";
import { THEMES } from "../Theme";
import { stitch } from "../Stitcher";
import { AnchorDetail } from "../AnchorDetail";
import type { EventBus } from "../../core/EventBus";
import type { FloorBundle } from "../FloorManager";

const HUNT_NOISE_BUDGET = 5.0;
const SCRATCH = new Vector3();

/**
 * Floor 3 — Flooded Halls. Shifting geometry behind the player, ghost markers
 * (already global), second Hunting encounter triggered when the player's total
 * emitted noise exceeds HUNT_NOISE_BUDGET. Bluish water-line palette, dense fog.
 */
export function buildFloodedFloor(bus: EventBus): FloorBundle {
  const specs = stitch({ seed: 9173, count: 17, bounds: 3, loopChance: 0.55 });
  const floor = new Floor(specs, bus, THEMES.flooded);
  floor.id = "flooded";
  floor.spawnPoint = new Vector3(0, 0, 0);

  const sortedByDist = [...floor.tiles].sort(
    (a, b) => Math.hypot(b.gx, b.gz) - Math.hypot(a.gx, a.gz)
  );

  // Anchor: a single shoe near the middle, easily missable
  if (sortedByDist.length > 6) {
    const mid = sortedByDist[Math.floor(sortedByDist.length / 2)];
    floor.addAnchor(new AnchorDetail(new Vector3(mid.gx * TILE_SIZE + 1.2, 0, mid.gz * TILE_SIZE - 0.8), "shoe"));
  }

  // Track noise budget so Hunting fires once we cross threshold
  let noiseAccum = 0;
  let huntFired = false;
  const off = bus.on("noise.emitted", (n) => {
    if (n.kind === "phantom" || n.kind === "scrape") return;
    noiseAccum += n.intensity;
  });
  // off() will leak across floor reloads — that's fine; the Floor3 instance is
  // recreated on every load, and the closure variables reset.
  void off;

  // Pick a few middle tiles for shifting geometry
  const shiftTiles = sortedByDist.slice(
    Math.floor(sortedByDist.length / 4),
    Math.floor((sortedByDist.length * 3) / 4)
  );

  const exit = sortedByDist[0];
  const exMin = new Vector3(exit.gx * TILE_SIZE - 1.5, 0, exit.gz * TILE_SIZE - 1.5);
  const exMax = new Vector3(exit.gx * TILE_SIZE + 1.5, 3, exit.gz * TILE_SIZE + 1.5);

  return {
    floor,
    exits: [{ bounds: new Box3(exMin, exMax), nextFloor: "same" }],
    threatSpawn: sortedByDist[Math.floor(sortedByDist.length / 2)]
      ? {
          gx: sortedByDist[Math.floor(sortedByDist.length / 2)].gx,
          gz: sortedByDist[Math.floor(sortedByDist.length / 2)].gz,
        }
      : undefined,
    scriptedHuntingOnly: true,
    installShifting: (shifting) => {
      for (const t of shiftTiles) {
        shifting.add(t, () => {
          // Alt = clones of the original walls but with slightly red-shifted color
          const alt: Mesh[] = [];
          for (const orig of t.mainMeshes) {
            const clone = orig.clone();
            const m = (orig.material as MeshStandardMaterial).clone();
            m.color.offsetHSL(0, 0, -0.06);
            m.color.r = Math.min(1, m.color.r + 0.06);
            clone.material = m;
            alt.push(clone);
          }
          return alt;
        });
      }
    },
    onTick: (ctx) => {
      if (!huntFired && noiseAccum > HUNT_NOISE_BUDGET) {
        huntFired = true;
        // Spawn the threat in the tile behind the player
        SCRATCH.copy(ctx.playerPos);
        const gx = Math.round(SCRATCH.x / TILE_SIZE);
        const gz = Math.round(SCRATCH.z / TILE_SIZE);
        const behind = floor.tiles.find((t) => Math.abs(t.gx - gx) + Math.abs(t.gz - gz) === 2)
          ?? floor.tiles[Math.floor(Math.random() * floor.tiles.length)];
        ctx.threat.tileX = behind.gx;
        ctx.threat.tileZ = behind.gz;
        ctx.threat.worldPos.set(behind.gx * TILE_SIZE, 0, behind.gz * TILE_SIZE);
        ctx.threat.group.position.copy(ctx.threat.worldPos);
        ctx.threat.forceHunt();
      }
    },
  };
}
