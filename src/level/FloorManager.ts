import { Box3, FogExp2, Scene, Vector3 } from "three";
import { Floor } from "./Floor";
import { ShiftingGeometry, TriggerSystem } from "./SeamTricks";
import type { Trigger } from "./SeamTricks";
import { ExitMarker } from "./ExitMarker";
import type { EventBus } from "../core/EventBus";
import type { Fader } from "../render/Fader";
import type { ThreatEntity } from "../entity/ThreatEntity";
import type { PlayerController } from "../player/PlayerController";

export interface FloorBundle {
  floor: Floor;
  /** Static triggers (loops, blinks) registered on the trigger system. */
  triggers?: Trigger[];
  /** Exit triggers — bounds + next floor id. Wired by FloorManager. */
  exits?: { bounds: Box3; nextFloor: string }[];
  /**
   * Optional explicit exit-marker positions. If omitted, FloorManager places
   * one marker at the center of each `exits[]` bounds. Provide this for
   * floors whose "exit" isn't represented in `exits[]` (e.g. Floor 5's door).
   */
  exitMarkers?: Vector3[];
  /** Shifting-geometry entries to install. */
  installShifting?: (shifting: ShiftingGeometry) => void;
  /** Where the threat entity should spawn (if any). */
  threatSpawn?: { gx: number; gz: number };
  /** When true, this floor scripts its own Hunting state — FSM won't auto-promote. */
  scriptedHuntingOnly?: boolean;
  /** Per-floor frame hook (for scripted encounters, end-of-floor logic, etc.). */
  onTick?: (ctx: FloorTickCtx) => void;
}

export interface FloorTickCtx {
  dt: number;
  elapsed: number;
  playerPos: Vector3;
  threat: ThreatEntity;
  manager: FloorManager;
  fader: Fader;
  /** Live sanity reference (current + min observed). */
  sanity: { current: number; minObserved: number; lock: () => void };
}

export type FloorBuilder = (bus: EventBus) => FloorBundle;

/**
 * Owns the currently loaded floor and orchestrates transitions. Each floor is
 * a builder fn registered up front; loadFloor swaps everything atomically.
 */
export class FloorManager {
  current: FloorBundle | null = null;
  readonly triggers = new TriggerSystem();
  readonly shifting = new ShiftingGeometry();
  /** Captured by the latest loadFloor — main loop reads this each tick. */
  onTick: ((ctx: FloorTickCtx) => void) | null = null;
  private exitMarkers: ExitMarker[] = [];

  private builders = new Map<string, FloorBuilder>();

  constructor(
    private bus: EventBus,
    private scene: Scene,
    public fader: Fader,
    private threat: ThreatEntity,
    private player: PlayerController
  ) {
    // Re-add the threat group whenever a new floor loads — but only once total.
    this.scene.add(this.threat.group);
  }

  register(id: string, builder: FloorBuilder): void {
    this.builders.set(id, builder);
  }

  async loadFloor(id: string, opts?: { cinematic?: boolean }): Promise<void> {
    const builder = this.builders.get(id);
    if (!builder) {
      console.warn(`FloorManager: unknown floor "${id}"`);
      return;
    }
    const previous = this.current?.floor.id ?? "";
    const swap = (): void => {
      // Tear down existing
      if (this.current) {
        this.scene.remove(this.current.floor.group);
        for (const a of this.current.floor.anchors) a.dispose();
      }
      for (const em of this.exitMarkers) {
        this.scene.remove(em.object);
        em.dispose();
      }
      this.exitMarkers.length = 0;
      this.triggers.clear();
      this.shifting.entries.length = 0;

      // Build new
      const bundle = builder(this.bus);
      this.current = bundle;
      this.scene.add(bundle.floor.group);

      // Update fog/scene atmosphere from theme
      const th = bundle.floor.theme;
      this.scene.fog = new FogExp2(th.fog.getHex(), th.fogDensity);
      this.scene.background = th.fog;

      // Triggers
      if (bundle.triggers) for (const t of bundle.triggers) this.triggers.add(t);
      if (bundle.exits) {
        for (const e of bundle.exits) {
          const next = e.nextFloor;
          this.triggers.add({
            bounds: e.bounds,
            oneShot: true,
            onEnter: () => {
              void this.loadFloor(next);
            },
          });
        }
      }
      if (bundle.installShifting) bundle.installShifting(this.shifting);

      // Exit markers — derive from exits[] unless the floor provides explicit positions
      const markerPositions: Vector3[] = bundle.exitMarkers
        ? bundle.exitMarkers.slice()
        : (bundle.exits ?? []).map((e) => e.bounds.getCenter(new Vector3()));
      for (const p of markerPositions) {
        const em = new ExitMarker(p);
        this.exitMarkers.push(em);
        this.scene.add(em.object);
      }

      // Player
      this.player.position.copy(bundle.floor.spawnPoint);
      this.player.velocity.set(0, 0, 0);
      this.player.collider.staticBoxes = bundle.floor.colliders;

      // Threat
      this.threat.fsm.setScriptedOnly(bundle.scriptedHuntingOnly ?? false);
      this.threat.setFloor(bundle.floor, bundle.threatSpawn);
      this.threat.fsm.reset();

      // Per-floor tick
      this.onTick = bundle.onTick ?? null;

      this.bus.emit("floor.transition", { from: previous, to: bundle.floor.id });
    };

    if (opts?.cinematic !== false) await this.fader.cinematic(swap);
    else swap();
  }

  /** ExitDoor convenience: a tile-aligned trigger that loads another floor. */
  registerExitTrigger(box: Box3, nextId: string): Trigger {
    return this.triggers.add({
      bounds: box,
      oneShot: true,
      onEnter: () => {
        void this.loadFloor(nextId);
      },
    });
  }

  /** Pulse the doorway markers each frame. */
  tickExitMarkers(dt: number): void {
    for (const em of this.exitMarkers) em.tick(dt);
  }
}
