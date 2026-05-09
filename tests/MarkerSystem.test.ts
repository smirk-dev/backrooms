import { describe, it, expect, beforeEach } from "vitest";
import { Vector3 } from "three";
import { EventBus } from "../src/core/EventBus";
import { SanitySystem } from "../src/sanity/SanitySystem";
import { MarkerSystem } from "../src/markers/MarkerSystem";

describe("MarkerSystem", () => {
  let bus: EventBus;
  let sanity: SanitySystem;
  let m: MarkerSystem;

  beforeEach(() => {
    bus = new EventBus();
    sanity = new SanitySystem(bus);
    m = new MarkerSystem(bus, sanity);
  });

  it("starts with 6 markers available", () => {
    expect(m.available).toBe(6);
  });

  it("placement decrements count and emits noise", () => {
    let noises = 0;
    bus.on("noise.emitted", (n) => {
      if (n.kind === "marker") noises++;
    });
    expect(m.tryPlace(new Vector3(1, 0, 1))).toBe(true);
    expect(m.available).toBe(5);
    expect(noises).toBe(1);
  });

  it("returns false when out of markers", () => {
    for (let i = 0; i < 6; i++) m.tryPlace(new Vector3(i, 0, 0));
    expect(m.available).toBe(0);
    expect(m.tryPlace(new Vector3())).toBe(false);
  });

  it("ghost markers do not spawn at high sanity", () => {
    sanity.value = 0.9;
    // Simulate 60s of update
    for (let i = 0; i < 60; i++) m.update(1, i, new Vector3(), ["tile_0_0"]);
    // We can't directly inspect ghosts; check the group child count.
    expect(m.group.children.length).toBe(0);
  });

  it("ghost markers spawn at low sanity in visited tiles", () => {
    sanity.value = 0.2; // below GHOST_TRIGGER_BELOW
    // Big elapsed jump to bypass interval
    m.update(0.016, 100, new Vector3(0, 0, 0), ["tile_5_5"]);
    expect(m.group.children.length).toBeGreaterThan(0);
  });

  it("real marker fades and frees its slot after lifetime", () => {
    m.tryPlace(new Vector3(0, 0, 0));
    expect(m.available).toBe(5);
    // 601s simulated
    m.update(601, 601, new Vector3(99, 0, 99), []);
    expect(m.available).toBe(6);
  });
});
