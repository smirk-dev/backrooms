import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { EventBus } from "../src/core/EventBus";
import { Hearing } from "../src/entity/Hearing";

const emit = (
  bus: EventBus,
  pos: Vector3,
  radius: number,
  intensity: number,
  kind: "footstep" | "phantom" | "scrape" | "marker" = "footstep"
) => bus.emit("noise.emitted", { pos, radius, intensity, kind });

describe("Hearing", () => {
  it("ignores phantom and scrape noises entirely", () => {
    const bus = new EventBus();
    const entityPos = new Vector3(0, 0, 0);
    const h = new Hearing(bus, () => entityPos, () => 0);
    emit(bus, new Vector3(1, 0, 0), 5, 1.0, "phantom");
    emit(bus, new Vector3(1, 0, 0), 5, 1.0, "scrape");
    expect(h.alertness).toBe(0);
    expect(h.lastNoisePos).toBeNull();
  });

  it("ignores noises outside its radius", () => {
    const bus = new EventBus();
    const h = new Hearing(bus, () => new Vector3(0, 0, 0), () => 0);
    emit(bus, new Vector3(10, 0, 0), 4, 1.0);
    expect(h.alertness).toBe(0);
  });

  it("scales alertness by (1 - distance/radius) * intensity", () => {
    const bus = new EventBus();
    const h = new Hearing(bus, () => new Vector3(0, 0, 0), () => 0);
    emit(bus, new Vector3(2, 0, 0), 4, 0.5);
    // (1 - 2/4) * 0.5 = 0.25
    expect(h.alertness).toBeCloseTo(0.25, 4);
  });

  it("clamps alertness to 1", () => {
    const bus = new EventBus();
    const h = new Hearing(bus, () => new Vector3(0, 0, 0), () => 0);
    for (let i = 0; i < 10; i++) emit(bus, new Vector3(0, 0, 0), 5, 1);
    expect(h.alertness).toBe(1);
  });

  it("records last noise position and timestamp", () => {
    const bus = new EventBus();
    let now = 0;
    const h = new Hearing(bus, () => new Vector3(0, 0, 0), () => now);
    now = 5;
    emit(bus, new Vector3(2, 0, 1), 5, 0.4);
    expect(h.lastNoisePos).toEqual({ x: 2, z: 1 });
    expect(h.lastNoiseAt).toBe(5);
  });

  it("decays over time", () => {
    const bus = new EventBus();
    const h = new Hearing(bus, () => new Vector3(0, 0, 0), () => 0);
    emit(bus, new Vector3(0, 0, 0), 5, 0.5);
    expect(h.alertness).toBeCloseTo(0.5, 4);
    h.decay(2);
    expect(h.alertness).toBeCloseTo(0.5 - 0.04 * 2, 4);
  });

  it("reset clears state", () => {
    const bus = new EventBus();
    const h = new Hearing(bus, () => new Vector3(0, 0, 0), () => 0);
    emit(bus, new Vector3(0, 0, 0), 5, 0.5);
    h.reset();
    expect(h.alertness).toBe(0);
    expect(h.lastNoisePos).toBeNull();
  });
});
