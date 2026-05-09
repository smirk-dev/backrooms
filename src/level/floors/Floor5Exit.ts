import { Box3, Vector3 } from "three";
import { Floor } from "../Floor";
import { TILE_SIZE } from "../Tile";
import { THEMES } from "../Theme";
import { AnchorDetail } from "../AnchorDetail";
import type { EventBus } from "../../core/EventBus";
import type { FloorBundle } from "../FloorManager";

const SCRATCH = new Vector3();
const TRUE_EXIT_THRESHOLD = 0.6;

/**
 * Floor 5 — Exit. Two pale-bright tiles. A single door leads out. If sanity
 * minObserved stayed > TRUE_EXIT_THRESHOLD, the player gets the "true exit":
 * a long white fade and a quiet credits overlay. Otherwise: anti-resolution —
 * fade back into the lobby with sanity locked at 0.1.
 */
export function buildExitFloor(bus: EventBus): FloorBundle {
  const floor = new Floor(
    [
      { gx: 0, gz: 0, doors: ["E"], seed: 21 },
      { gx: 1, gz: 0, doors: ["W"], seed: 22 },
    ],
    bus,
    THEMES.exit
  );
  floor.id = "exit";
  floor.spawnPoint = new Vector3(0, 0, 0);

  // A lamp anchor by the door for warmth
  floor.addAnchor(new AnchorDetail(new Vector3(1 * TILE_SIZE + 1.5, 0, 0), "lamp"));

  // Door trigger at the eastern wall
  const doorMin = new Vector3(1 * TILE_SIZE + 2.5, 0, -1.5);
  const doorMax = new Vector3(1 * TILE_SIZE + 4.0, 3, 1.5);
  let resolved = false;

  return {
    floor,
    onTick: (ctx) => {
      if (resolved) return;
      SCRATCH.copy(ctx.playerPos);
      if (
        SCRATCH.x >= doorMin.x &&
        SCRATCH.x <= doorMax.x &&
        SCRATCH.z >= doorMin.z &&
        SCRATCH.z <= doorMax.z
      ) {
        resolved = true;
        if (ctx.sanity.minObserved > TRUE_EXIT_THRESHOLD) {
          // True exit: long white fade + credits
          showCredits(true);
          ctx.fader.hold();
        } else {
          // Anti-resolution: cinematic to lobby with sanity locked low
          ctx.sanity.lock();
          void ctx.manager.loadFloor("lobby");
        }
      }
      void doorMax; // referenced via Box3 below if we want to expose it
    },
    // Exposing the door zone in case a future debug HUD wants it
    triggers: [{ bounds: new Box3(doorMin, doorMax) }],
    exitMarkers: [new Vector3((doorMin.x + doorMax.x) / 2 - 0.6, 0, 0)],
  };
}

function showCredits(trueExit: boolean): void {
  const div = document.createElement("div");
  Object.assign(div.style, {
    position: "fixed",
    inset: "0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: trueExit ? "#fff8e0" : "#000",
    color: trueExit ? "#564a22" : "#a89c70",
    zIndex: "20",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: "0.95rem",
    letterSpacing: "0.08em",
    transition: "opacity 1.5s linear",
    opacity: "0",
  });
  div.innerHTML = trueExit
    ? `<div style="opacity:0.7;">you walked out.</div><div style="margin-top:1.6em;font-size:0.7rem;letter-spacing:0.3em;text-transform:uppercase;opacity:0.4;">end</div>`
    : `<div style="opacity:0.7;">it never quite ends.</div><div style="margin-top:1.6em;font-size:0.7rem;letter-spacing:0.3em;text-transform:uppercase;opacity:0.4;">end</div>`;
  document.body.appendChild(div);
  requestAnimationFrame(() => (div.style.opacity = "1"));
}
