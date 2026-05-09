import { Camera, Vector3 } from "three";
import type { EventBus, NoiseKind } from "../core/EventBus";

const FORWARD = new Vector3();
const UP = new Vector3();

/**
 * Master audio chain: source -> PannerNode -> filter -> delay -> master gain -> destination.
 * The filter and delay are modulated by sanity. Listener position/orientation is
 * synced to the player camera each frame.
 */
export class AudioBus {
  ctx: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  delay: DelayNode;
  delayFeedback: GainNode;
  delayMix: GainNode;
  hum?: AudioBufferSourceNode;
  humGain?: GainNode;

  private noiseBuffer: AudioBuffer;

  constructor(private bus: EventBus) {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 18000;
    this.filter.Q.value = 0.4;

    this.delay = this.ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.18;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.0;
    this.delayMix = this.ctx.createGain();
    this.delayMix.gain.value = 0.0;

    this.filter.connect(this.master);
    this.master.connect(this.ctx.destination);

    // Wet path for delay
    this.filter.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayMix);
    this.delayMix.connect(this.master);

    // 1-second white noise buffer reused for footsteps/bumps
    const sr = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, sr, sr);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.bus.on("noise.emitted", (n) => {
      if (n.kind === "phantom") this.playPhantom(n.pos);
      else if (n.kind === "footstep" || n.kind === "run") this.playFootstep(n.pos, n.kind === "run");
      else if (n.kind === "marker") this.playMarkerClack(n.pos);
      else if (n.kind === "bump") this.playBump(n.pos);
      else if (n.kind === "flashlight") this.playClick(n.pos);
      else if (n.kind === "scrape") this.playScrape(n.pos);
    });

    this.bus.on("sanity.changed", (s) => this.applySanity(s.value));
  }

  /** Resume on user gesture (autoplay policy). */
  async unlock(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
    this.startAmbientHum();
  }

  /** Sync listener to camera each frame. */
  syncListener(camera: Camera): void {
    const l = this.ctx.listener;
    const p = camera.getWorldPosition(new Vector3());
    camera.getWorldDirection(FORWARD);
    UP.set(0, 1, 0);
    if ("positionX" in l) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(p.x, t);
      l.positionY.setValueAtTime(p.y, t);
      l.positionZ.setValueAtTime(p.z, t);
      l.forwardX.setValueAtTime(FORWARD.x, t);
      l.forwardY.setValueAtTime(FORWARD.y, t);
      l.forwardZ.setValueAtTime(FORWARD.z, t);
      l.upX.setValueAtTime(UP.x, t);
      l.upY.setValueAtTime(UP.y, t);
      l.upZ.setValueAtTime(UP.z, t);
    } else {
      // Older API
      // @ts-expect-error legacy
      l.setPosition(p.x, p.y, p.z);
      // @ts-expect-error legacy
      l.setOrientation(FORWARD.x, FORWARD.y, FORWARD.z, UP.x, UP.y, UP.z);
    }
  }

  private applySanity(value: number): void {
    const t = this.ctx.currentTime;
    // Lowpass closes as sanity drops
    const target = 18000 - (1 - value) * 11000;
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.linearRampToValueAtTime(target, t + 0.6);
    // Delay feedback opens below 0.4
    const wet = Math.max(0, 0.4 - value) * 0.9;
    this.delayMix.gain.cancelScheduledValues(t);
    this.delayMix.gain.linearRampToValueAtTime(wet, t + 0.6);
    this.delayFeedback.gain.cancelScheduledValues(t);
    this.delayFeedback.gain.linearRampToValueAtTime(Math.min(0.55, wet * 1.3), t + 0.6);
  }

  private startAmbientHum(): void {
    if (this.hum) return;
    // 60Hz-ish fluorescent buzz from two slightly detuned saws + filter.
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = "sawtooth";
    o2.type = "sawtooth";
    o1.frequency.value = 60;
    o2.frequency.value = 120.7;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = 1.4;
    lfo.connect(lfoGain).connect(o1.frequency);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "lowpass";
    hp.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.04;
    o1.connect(hp);
    o2.connect(hp);
    hp.connect(g).connect(this.filter);
    o1.start();
    o2.start();
    lfo.start();
    this.humGain = g;
  }

  // ---- One-shot SFX (procedural so we don't ship audio yet) ----

  private spatial(pos: Vector3): PannerNode {
    const p = this.ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 1.2;
    p.rolloffFactor = 1.4;
    p.maxDistance = 60;
    const t = this.ctx.currentTime;
    if ("positionX" in p) {
      p.positionX.setValueAtTime(pos.x, t);
      p.positionY.setValueAtTime(pos.y, t);
      p.positionZ.setValueAtTime(pos.z, t);
    } else {
      // @ts-expect-error legacy
      p.setPosition(pos.x, pos.y, pos.z);
    }
    p.connect(this.filter);
    return p;
  }

  private noiseBurst(pos: Vector3, dur: number, gain: number, lpf: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const env = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lpf;
    const panner = this.spatial(pos);
    src.connect(filter).connect(env).connect(panner);
    const t = this.ctx.currentTime;
    env.gain.setValueAtTime(0.0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private playFootstep(pos: Vector3, run: boolean): void {
    this.noiseBurst(pos, run ? 0.13 : 0.08, run ? 0.35 : 0.18, run ? 1100 : 800);
  }

  private playBump(pos: Vector3): void {
    this.noiseBurst(pos, 0.25, 0.45, 380);
  }

  private playMarkerClack(pos: Vector3): void {
    const src = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const panner = this.spatial(pos);
    src.type = "square";
    src.frequency.value = 1700;
    src.connect(env).connect(panner);
    const t = this.ctx.currentTime;
    env.gain.setValueAtTime(0.0, t);
    env.gain.linearRampToValueAtTime(0.18, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.start(t);
    src.stop(t + 0.1);
    // Add a noise tail
    this.noiseBurst(pos, 0.06, 0.08, 4000);
  }

  private playClick(pos: Vector3): void {
    this.noiseBurst(pos, 0.04, 0.12, 4000);
  }

  private playPhantom(pos: Vector3): void {
    // Same as a soft footstep but quieter and slightly muffled — appears behind player.
    this.noiseBurst(pos, 0.1, 0.12, 600);
  }

  // ---- Threat audio cues (called by main loop on entity.statechange) ----

  private heartbeat?: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode };

  startHeartbeat(): void {
    if (this.heartbeat) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 58;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 1.6; // ~96 bpm
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.32;
    lfo.connect(lfoGain).connect(gain.gain);
    osc.connect(gain).connect(this.master);
    osc.start();
    lfo.start();
    // Duck other audio while hunting: pull master down a touch
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(0.65, t + 0.4);
    this.heartbeat = { osc, gain, lfo };
  }

  stopHeartbeat(): void {
    if (!this.heartbeat) return;
    const { osc, lfo } = this.heartbeat;
    const t = this.ctx.currentTime;
    osc.stop(t + 0.6);
    lfo.stop(t + 0.6);
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(0.85, t + 0.6);
    this.heartbeat = undefined;
  }

  playScrape(pos: Vector3): void {
    this.noiseBurst(pos, 0.8, 0.18, 280);
  }

  /** Brief soundtrack-of-being-grabbed: low whoosh + cut. */
  playGrab(pos: Vector3): void {
    this.noiseBurst(pos, 0.45, 0.85, 220);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = 80;
    o.connect(g).connect(this.master);
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.7);
    o.start(t);
    o.stop(t + 0.75);
  }

  /** Used by sanity for an unease-inducing low rumble pulse. */
  emitDreadPulse(pos: Vector3): void {
    const src = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const panner = this.spatial(pos);
    src.type = "sine";
    src.frequency.value = 38;
    src.connect(env).connect(panner);
    const t = this.ctx.currentTime;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.4, t + 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    src.start(t);
    src.stop(t + 2.6);
  }
}

export type { NoiseKind };
