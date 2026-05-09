import { describe, it, expect, beforeEach } from "vitest";
import { Vector3 } from "three";
import { EventBus } from "../src/core/EventBus";
import { SanitySystem } from "../src/sanity/SanitySystem";

const ctx = (over: Partial<Parameters<SanitySystem["update"]>[1]> = {}) => ({
  flashlightOn: true,
  sprinting: false,
  threatVisible: false,
  playerPos: new Vector3(),
  cameraForward: new Vector3(0, 0, -1),
  ...over,
});

describe("SanitySystem", () => {
  let bus: EventBus;
  let sanity: SanitySystem;

  beforeEach(() => {
    bus = new EventBus();
    sanity = new SanitySystem(bus);
  });

  it("starts at full sanity", () => {
    expect(sanity.value).toBe(1);
    expect(sanity.minObserved).toBe(1);
  });

  it("decays gently in a seen tile by base rate", () => {
    sanity.update(1, ctx());
    expect(sanity.value).toBeCloseTo(1 - 0.002, 4);
  });

  it("decays faster when sprinting + dark + threat visible", () => {
    sanity.update(1, ctx({ flashlightOn: false, sprinting: true, threatVisible: true }));
    // 0.002 + 0.005 + 0.01 + 0.05 = 0.067
    expect(sanity.value).toBeCloseTo(1 - 0.067, 4);
  });

  it("recovers on novel tile entry", () => {
    sanity.adjust(-0.5);
    bus.emit("tile.entered", { id: "tile_5_5", novel: true });
    expect(sanity.value).toBeCloseTo(0.5 + 0.15, 4);
  });

  it("does not recover on previously visited tile", () => {
    sanity.adjust(-0.5);
    const before = sanity.value;
    bus.emit("tile.entered", { id: "tile_5_5", novel: false });
    expect(sanity.value).toBe(before);
  });

  it("clamps to [0,1]", () => {
    sanity.adjust(-5);
    expect(sanity.value).toBe(0);
    sanity.adjust(+5);
    expect(sanity.value).toBe(1);
  });

  it("tracks minObserved", () => {
    sanity.adjust(-0.4);
    expect(sanity.minObserved).toBeCloseTo(0.6, 4);
    sanity.adjust(+0.2);
    expect(sanity.minObserved).toBeCloseTo(0.6, 4);
    sanity.adjust(-0.5);
    expect(sanity.minObserved).toBeCloseTo(0.3, 4);
  });

  it("locked sanity ignores adjust()", () => {
    sanity.locked = true;
    sanity.adjust(-0.5);
    expect(sanity.value).toBe(1);
  });

  it("emits sanity.changed on real change", () => {
    let count = 0;
    bus.on("sanity.changed", () => count++);
    sanity.adjust(-0.1);
    sanity.adjust(0); // no change
    expect(count).toBe(1);
  });

  it("FOV target oscillates around base by amount scaled with decay", () => {
    sanity.value = 1; // no decay → noise multiplier is 0 → fov == base
    expect(Math.abs(sanity.fovTarget(1) - 74)).toBeLessThan(0.001);
    sanity.value = 0; // full decay → noise can move fov
    const moved = sanity.fovTarget(1);
    expect(Math.abs(moved - 74)).toBeGreaterThan(0);
  });
});
