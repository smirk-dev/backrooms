import { Box3, Vector3 } from "three";
import { Floor } from "../Floor";
import type { TileSpec } from "../Floor";
import { THEMES } from "../Theme";
import { TILE_SIZE } from "../Tile";
import type { EventBus } from "../../core/EventBus";
import type { FloorBundle } from "../FloorManager";
import { AnchorDetail } from "../AnchorDetail";

/**
 * Floor 0 — the lobby. Six tiles in a small loop. Teaches movement, flashlight,
 * marker placement. One anchor (chair) seeded as a recovery target.
 *
 *   (0,-1)─(1,-1)
 *     │      │
 *   (0, 0)─(1, 0)─(2, 0)
 *            │
 *          (1, 1)
 *
 * Exit: stepping into tile (2,0) — the lone alcove — transitions to "offices".
 */
export function buildLobbyFloor(bus: EventBus): FloorBundle {
  const specs: TileSpec[] = [
    { gx: 0, gz: 0, doors: ["N", "E"], seed: 1 },
    { gx: 1, gz: 0, doors: ["N", "W", "E", "S"], seed: 2 },
    { gx: 2, gz: 0, doors: ["W"], seed: 3 },
    { gx: 0, gz: -1, doors: ["S", "E"], seed: 4 },
    { gx: 1, gz: -1, doors: ["S", "W"], seed: 5 },
    { gx: 1, gz: 1, doors: ["N"], seed: 6 },
  ];
  const floor = new Floor(specs, bus, THEMES.lobby);
  floor.id = "lobby";
  floor.spawnPoint = new Vector3(0, 0, 0);

  // Authored anchor: chair in the corner room (1,1)
  floor.addAnchor(new AnchorDetail(new Vector3(1 * TILE_SIZE - 1.6, 0, 1 * TILE_SIZE - 1.6), "chair"));

  // Exit alcove — entering tile (2,0) loads offices
  const exitMin = new Vector3(2 * TILE_SIZE - 2.0, 0, 0 * TILE_SIZE - 2.0);
  const exitMax = new Vector3(2 * TILE_SIZE + 2.0, 3, 0 * TILE_SIZE + 2.0);
  return {
    floor,
    exits: [{ bounds: new Box3(exitMin, exitMax), nextFloor: "offices" }],
    threatSpawn: { gx: 1, gz: 1 },
  };
}
