import { describe, it, expect } from "vitest";
import { stitch, mulberry32 } from "../src/level/Stitcher";

describe("Stitcher", () => {
  it("is deterministic given the same seed", () => {
    const a = stitch({ seed: 42, count: 12, bounds: 3, loopChance: 0.4 });
    const b = stitch({ seed: 42, count: 12, bounds: 3, loopChance: 0.4 });
    expect(a.length).toBe(b.length);
    expect(a).toEqual(b);
  });

  it("differs across seeds", () => {
    const a = stitch({ seed: 1, count: 12, bounds: 3, loopChance: 0.4 });
    const b = stitch({ seed: 2, count: 12, bounds: 3, loopChance: 0.4 });
    expect(a).not.toEqual(b);
  });

  it("respects bounds", () => {
    const specs = stitch({ seed: 17, count: 30, bounds: 2, loopChance: 0.6 });
    for (const s of specs) {
      expect(Math.abs(s.gx)).toBeLessThanOrEqual(2);
      expect(Math.abs(s.gz)).toBeLessThanOrEqual(2);
    }
  });

  it("respects count cap", () => {
    const specs = stitch({ seed: 11, count: 8, bounds: 5, loopChance: 0.7 });
    expect(specs.length).toBeLessThanOrEqual(8);
  });

  it("mirrors door connectivity at every shared edge", () => {
    const specs = stitch({ seed: 333, count: 18, bounds: 4, loopChance: 0.5 });
    const map = new Map(specs.map((s) => [`${s.gx},${s.gz}`, s]));
    const opp = { N: "S", S: "N", E: "W", W: "E" } as const;
    const step: Record<keyof typeof opp, [number, number]> = {
      N: [0, -1],
      S: [0, 1],
      E: [1, 0],
      W: [-1, 0],
    };
    for (const s of specs) {
      for (const d of s.doors) {
        const [dx, dz] = step[d];
        const neighbor = map.get(`${s.gx + dx},${s.gz + dz}`);
        if (!neighbor) continue;
        expect(neighbor.doors).toContain(opp[d]);
      }
    }
  });

  it("mulberry32 produces deterministic uniform stream", () => {
    const r = mulberry32(99);
    const seq = Array.from({ length: 5 }, () => r());
    const r2 = mulberry32(99);
    const seq2 = Array.from({ length: 5 }, () => r2());
    expect(seq).toEqual(seq2);
    for (const v of seq) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
