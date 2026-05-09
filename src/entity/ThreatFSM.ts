import type { ThreatState } from "../core/EventBus";
import type { EventBus } from "../core/EventBus";

const PROMOTE_STIR = 0.3;
const PROMOTE_ALERT = 0.6;
const PROMOTE_HUNT = 0.85;
const RETREAT_SILENCE_SECS = 20;

interface FSMOpts {
  /** Hard cap on Hunting transitions per playthrough (default 3). */
  huntingCap?: number;
  /** When true, Hunting cannot be reached automatically — only via forceHunt(). */
  scriptedHuntingOnly?: boolean;
}

export class ThreatFSM {
  state: ThreatState = "Dormant";
  huntCount = 0;
  private opts: Required<FSMOpts>;

  constructor(private bus: EventBus, opts: FSMOpts = {}) {
    this.opts = {
      huntingCap: opts.huntingCap ?? 3,
      scriptedHuntingOnly: opts.scriptedHuntingOnly ?? false,
    };
  }

  step(alertness: number, secsSinceLastNoise: number): void {
    const cur = this.state;
    let next: ThreatState = cur;
    if (cur === "Dormant") {
      if (alertness > PROMOTE_STIR) next = "Stirring";
    } else if (cur === "Stirring") {
      if (alertness > PROMOTE_ALERT) next = "Alerted";
      else if (secsSinceLastNoise > RETREAT_SILENCE_SECS) next = "Retreating";
    } else if (cur === "Alerted") {
      if (
        !this.opts.scriptedHuntingOnly &&
        alertness > PROMOTE_HUNT &&
        this.huntCount < this.opts.huntingCap
      ) {
        next = "Hunting";
      } else if (secsSinceLastNoise > RETREAT_SILENCE_SECS) {
        next = "Retreating";
      }
    } else if (cur === "Hunting") {
      if (secsSinceLastNoise > RETREAT_SILENCE_SECS) next = "Retreating";
    } else if (cur === "Retreating") {
      // Self-resolves to Dormant after a brief tail
      if (secsSinceLastNoise > RETREAT_SILENCE_SECS + 4) next = "Dormant";
      else if (alertness > PROMOTE_ALERT) next = "Alerted";
    }
    if (next !== cur) this.transition(next);
  }

  /** Force into Hunting from any state (scripted encounters). */
  forceHunt(): void {
    if (this.huntCount >= this.opts.huntingCap) return;
    if (this.state === "Hunting") return;
    this.transition("Hunting");
  }

  /** Force back to Dormant after death or floor change. */
  reset(): void {
    if (this.state !== "Dormant") this.transition("Dormant");
  }

  setScriptedOnly(v: boolean): void {
    this.opts.scriptedHuntingOnly = v;
  }

  private transition(to: ThreatState): void {
    const from = this.state;
    this.state = to;
    if (to === "Hunting") this.huntCount++;
    this.bus.emit("entity.statechange", { from, to });
  }
}
