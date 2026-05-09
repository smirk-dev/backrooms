import { Vector3 } from "three";
import { Floor } from "../Floor";
import type { TileSpec } from "../Floor";
import { TILE_SIZE } from "../Tile";
import { THEMES } from "../Theme";
import { AnchorDetail } from "../AnchorDetail";
import type { EventBus } from "../../core/EventBus";
import type { FloorBundle } from "../FloorManager";

const SECRET_TILE = { gx: 2, gz: 1 };

/**
 * Floor 4 — The Same Room. A 4×4 grid of identical, fully-connected lobby
 * tiles. No threat. Pure dread-calm. One tile (and only one) contains a
 * tipped-over chair; finding it transitions to the exit. Otherwise the
 * player wanders identical rooms.
 */
export function buildSameRoomFloor(bus: EventBus): FloorBundle {
  const specs: TileSpec[] = [];
  for (let x = 0; x < 4; x++) {
    for (let z = 0; z < 4; z++) {
      // Open every door — fully connected grid (interior doors join, edge doors lead nowhere new)
      specs.push({ gx: x, gz: z, doors: ["N", "S", "E", "W"], seed: 17 });
    }
  }
  const floor = new Floor(specs, bus, THEMES.same);
  floor.id = "same";
  floor.spawnPoint = new Vector3(0, 0, 0);

  // The "different detail": a tipped-over chair in the secret tile.
  const chair = new AnchorDetail(
    new Vector3(SECRET_TILE.gx * TILE_SIZE + 0.5, 0, SECRET_TILE.gz * TILE_SIZE - 0.5),
    "chair"
  );
  // Hint that it's "wrong" — rotate to lay on its side
  chair.object.rotation.z = Math.PI / 2;
  chair.object.position.y = 0.25;
  floor.addAnchor(chair);

  let advanced = false;
  return {
    floor,
    onTick: (ctx) => {
      // When the secret chair is consumed, advance to the exit floor
      if (!advanced && chair.consumed) {
        advanced = true;
        void ctx.manager.loadFloor("exit");
      }
    },
  };
}
