import { AmbientLight, FogExp2, Vector3 } from "three";
import { EventBus } from "./EventBus";
import { GameLoop } from "./GameLoop";
import { Input } from "./Input";
import { Time } from "./Time";
import { Renderer } from "../render/Renderer";
import { Composer } from "../render/Composer";
import { Fader } from "../render/Fader";
import { PlayerController } from "../player/PlayerController";
import { AudioBus } from "../audio/AudioBus";
import { SanitySystem } from "../sanity/SanitySystem";
import { MarkerSystem } from "../markers/MarkerSystem";
import { AnchorSystem } from "../level/AnchorSystem";
import { ThreatEntity } from "../entity/ThreatEntity";
import { FloorManager } from "../level/FloorManager";
import { buildLobbyFloor } from "../level/floors/Floor0Lobby";
import { buildOfficesFloor } from "../level/floors/Floor1Offices";
import { buildGarageFloor } from "../level/floors/Floor2Garage";
import { buildFloodedFloor } from "../level/floors/Floor3Flooded";
import { buildSameRoomFloor } from "../level/floors/Floor4SameRoom";
import { buildExitFloor } from "../level/floors/Floor5Exit";

const FORWARD_SCRATCH = new Vector3();
const SPAWN = new Vector3(0, 0, 0);

async function start(): Promise<void> {
  const container = document.getElementById("app")!;
  const intro = document.getElementById("intro")!;

  const bus = new EventBus();
  const time = new Time();

  const renderer = new Renderer(container);
  const composer = new Composer(renderer);
  const fader = new Fader();

  // Atmosphere — overridden per-floor by FloorManager
  renderer.scene.fog = new FogExp2(0x0a0902, 0.07);
  renderer.scene.add(new AmbientLight(0x453a1f, 0.18));
  // Camera must be in the scene graph for camera-attached lights (flashlight)
  // to actually contribute to rendering. Without this, F toggles a light that
  // never reaches the renderer.
  renderer.scene.add(renderer.camera);

  // Player (initial spawn at origin; FloorManager will reposition)
  const input = new Input(renderer.domElement);
  const player = new PlayerController(renderer.camera, input, bus, SPAWN);

  // Audio
  const audio = new AudioBus(bus);

  // Sanity + markers + anchors
  const sanity = new SanitySystem(bus);
  const markers = new MarkerSystem(bus, sanity);
  renderer.scene.add(markers.group);
  const anchors = new AnchorSystem(sanity);

  // Threat
  const threat = new ThreatEntity(bus, { huntingCap: 3, scriptedHuntingOnly: false });

  // Floor manager — owns scene, fader, threat, player
  const floors = new FloorManager(bus, renderer.scene, fader, threat, player);
  floors.register("lobby", buildLobbyFloor);
  floors.register("offices", buildOfficesFloor);
  floors.register("garage", buildGarageFloor);
  floors.register("flooded", buildFloodedFloor);
  floors.register("same", buildSameRoomFloor);
  floors.register("exit", buildExitFloor);

  // Threat audio cue wiring
  bus.on("entity.statechange", (e) => {
    if (e.to === "Hunting") audio.startHeartbeat();
    if ((e.from === "Hunting" || e.from === "Alerted") && (e.to === "Retreating" || e.to === "Dormant")) {
      audio.stopHeartbeat();
    }
    if (e.to === "Stirring") audio.emitDreadPulse(threat.worldPos.clone());
  });

  // Death sequence: full fade, reset sanity & threat, drop into lobby
  bus.on("player.died", (d) => {
    audio.playGrab(d.pos);
    audio.stopHeartbeat();
    void fader.cinematic(async () => {
      threat.fsm.reset();
      sanity.set(Math.max(0.05, sanity.value - 0.4));
      await floors.loadFloor("lobby", { cinematic: false });
    });
  });

  // Pointer lock + audio unlock on click
  intro.addEventListener("click", async () => {
    intro.classList.add("hidden");
    input.requestPointerLock();
    await audio.unlock();
  });
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== renderer.domElement) {
      intro.classList.remove("hidden");
    }
  });

  // Initial floor load
  await floors.loadFloor("lobby", { cinematic: false });

  const sanityRef = {
    get current() {
      return sanity.value;
    },
    get minObserved() {
      return sanity.minObserved;
    },
    lock(): void {
      sanity.locked = true;
      sanity.set(0.1);
    },
  };

  const loop = new GameLoop(
    (dt) => {
      time.tick(dt);

      // 1. Player
      player.update(dt);

      // 2. Marker placement input
      if (input.wasPressed("KeyE")) markers.tryPlace(player.position);

      // 3. Floor: tile entered events
      if (floors.current) floors.current.floor.update(player.position);

      // 4. Triggers (loops, blinks, exits)
      floors.triggers.update(player.position);

      // 5. Sanity
      const ax = input.axes();
      const sprinting = ax.sprint && (ax.x !== 0 || ax.z !== 0);
      renderer.camera.getWorldDirection(FORWARD_SCRATCH);
      const threatVisible = threat.isVisibleFrom(renderer.camera);
      sanity.update(dt, {
        flashlightOn: player.flashlight.on,
        sprinting,
        threatVisible,
        playerPos: player.position,
        cameraForward: FORWARD_SCRATCH,
      });
      player.setFovTarget(sanity.fovTarget(time.elapsed));

      // 6. Threat
      threat.update(dt, player.position, renderer.camera);

      // 7. Markers + anchors
      const visited = floors.current?.floor.visited ?? [];
      markers.update(dt, time.elapsed, player.position, visited);
      if (floors.current) anchors.update(dt, floors.current.floor, player.position);

      // 8. Shifting geometry (only when player not looking)
      floors.shifting.update(renderer.camera);

      // 8b. Pulse exit-marker doorways
      floors.tickExitMarkers(dt);

      // 9. Per-floor scripted tick
      floors.onTick?.({
        dt,
        elapsed: time.elapsed,
        playerPos: player.position,
        threat,
        manager: floors,
        fader,
        sanity: sanityRef,
      });

      // 10. Audio listener
      audio.syncListener(renderer.camera);

      input.endFrame();
    },
    (_alpha) => {
      composer.render(time.elapsed, sanity.value);
    }
  );

  loop.start();
}

void start();
