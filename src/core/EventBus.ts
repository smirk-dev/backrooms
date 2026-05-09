import type { Vector3 } from "three";

export type NoiseKind =
  | "footstep"
  | "run"
  | "marker"
  | "bump"
  | "flashlight"
  | "phantom"
  | "scrape";

export interface NoiseEmitted {
  pos: Vector3;
  radius: number;
  intensity: number;
  kind: NoiseKind;
}

export interface SanityChanged {
  value: number;
  delta: number;
}

export interface MarkerPlaced {
  pos: Vector3;
  isGhost: boolean;
}

export interface TileEntered {
  id: string;
  novel: boolean;
}

export type ThreatState = "Dormant" | "Stirring" | "Alerted" | "Hunting" | "Retreating";

export interface EntityStateChange {
  from: ThreatState;
  to: ThreatState;
}

export interface PlayerDied {
  pos: Vector3;
}

export interface FloorTransition {
  from: string;
  to: string;
}

export interface EventMap {
  "noise.emitted": NoiseEmitted;
  "sanity.changed": SanityChanged;
  "marker.placed": MarkerPlaced;
  "tile.entered": TileEntered;
  "entity.statechange": EntityStateChange;
  "player.died": PlayerDied;
  "floor.transition": FloorTransition;
}

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;
type AnyListener = (payload: unknown) => void;

export class EventBus {
  private listeners = new Map<keyof EventMap, Set<AnyListener>>();

  on<K extends keyof EventMap>(event: K, fn: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = fn as AnyListener;
    set.add(wrapped);
    return () => set!.delete(wrapped);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) (fn as Listener<K>)(payload);
  }
}
