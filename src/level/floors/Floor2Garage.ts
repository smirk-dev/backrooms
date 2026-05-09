import { Box3, Vector3 } from "three";
import { Floor } from "../Floor";
import { TILE_SIZE } from "../Tile";
import { THEMES } from "../Theme";
import { stitch } from "../Stitcher";
import { AnchorDetail } from "../AnchorDetail";
import type { EventBus } from "../../core/EventBus";
import type { FloorBundle } from "../FloorManager";

const SCRATCH = new Vector3();

/**
 * Floor 2 — Parking Garage. The first scripted Hunting encounter. Concrete
 * palette, higher fog density. A blink-teleport mid-floor sells "you fell
 * through." Approaching the encounter zone forces the threat into Hunting.
 */
export function buildGarageFloor(bus: EventBus): FloorBundle {
  const specs = stitch({ seed: 1093, count: 16, bounds: 3, loopChance: 0.5 });
  const floor = new Floor(specs, bus, THEMES.garage);
  floor.id = "garage";
  floor.spawnPoint = new Vector3(0, 0, 0);

  const sortedByDist = [...floor.tiles].sort(
    (a, b) => Math.hypot(b.gx, b.gz) - Math.hypot(a.gx, a.gz)
  );

  if (sortedByDist.length > 4) {
    const mid = sortedByDist[Math.floor(sortedByDist.length / 2)];
    floor.addAnchor(new AnchorDetail(new Vector3(mid.gx * TILE_SIZE - 0.6, 0, mid.gz * TILE_SIZE), "chair"));
  }

  // Scripted hunt zone & blink-teleport zone (state captured in closures)
  const huntTile = sortedByDist[Math.floor(sortedByDist.length * 0.4)];
  const blinkSrc = sortedByDist[Math.floor(sortedByDist.length / 3)];
  const blinkDst = sortedByDist[Math.max(2, Math.floor(sortedByDist.length / 6))];
  const huntCenter = new Vector3(huntTile.gx * TILE_SIZE, 0, huntTile.gz * TILE_SIZE);
  const blinkCenter = new Vector3(blinkSrc.gx * TILE_SIZE, 0, blinkSrc.gz * TILE_SIZE);
  const blinkDestPos = new Vector3(blinkDst.gx * TILE_SIZE, 0, blinkDst.gz * TILE_SIZE);
  let huntFired = false;
  let blinkFired = false;

  const exit = sortedByDist[0];
  const exMin = new Vector3(exit.gx * TILE_SIZE - 1.5, 0, exit.gz * TILE_SIZE - 1.5);
  const exMax = new Vector3(exit.gx * TILE_SIZE + 1.5, 3, exit.gz * TILE_SIZE + 1.5);

  return {
    floor,
    exits: [{ bounds: new Box3(exMin, exMax), nextFloor: "flooded" }],
    threatSpawn: { gx: huntTile.gx, gz: huntTile.gz },
    scriptedHuntingOnly: true,
    onTick: (ctx) => {
      // Force Hunting once player gets close to the encounter tile
      if (!huntFired) {
        SCRATCH.copy(ctx.playerPos).sub(huntCenter);
        if (SCRATCH.lengthSq() < 4 * 4) {
          huntFired = true;
          ctx.threat.forceHunt();
        }
      }
      // Blink-teleport once
      if (!blinkFired) {
        SCRATCH.copy(ctx.playerPos).sub(blinkCenter);
        if (SCRATCH.lengthSq() < 1.4 * 1.4) {
          blinkFired = true;
          void ctx.fader.blink(() => {
            ctx.playerPos.copy(blinkDestPos);
          });
        }
      }
    },
  };
}
