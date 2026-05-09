import { describe, it, expect } from "vitest";
import { EventBus } from "../src/core/EventBus";
import { ThreatFSM } from "../src/entity/ThreatFSM";

describe("ThreatFSM", () => {
  it("starts Dormant and promotes through states with rising alertness", () => {
    const bus = new EventBus();
    const f = new ThreatFSM(bus);
    expect(f.state).toBe("Dormant");
    f.step(0.4, 0); // > 0.3 → Stirring
    expect(f.state).toBe("Stirring");
    f.step(0.7, 0); // > 0.6 → Alerted
    expect(f.state).toBe("Alerted");
    f.step(0.95, 0); // > 0.85 → Hunting
    expect(f.state).toBe("Hunting");
  });

  it("retreats on prolonged silence", () => {
    const bus = new EventBus();
    const f = new ThreatFSM(bus);
    f.step(0.7, 0);
    f.step(0.7, 0);
    expect(f.state).toBe("Alerted");
    f.step(0.0, 25); // > 20s silence
    expect(f.state).toBe("Retreating");
    f.step(0.0, 28); // settles back to Dormant after grace
    expect(f.state).toBe("Dormant");
  });

  it("respects scriptedHuntingOnly", () => {
    const bus = new EventBus();
    const f = new ThreatFSM(bus, { scriptedHuntingOnly: true });
    f.step(0.95, 0); // would normally promote to Hunting
    f.step(0.95, 0);
    expect(f.state).not.toBe("Hunting");
  });

  it("forceHunt bypasses scripted-only gate but respects huntingCap", () => {
    const bus = new EventBus();
    const f = new ThreatFSM(bus, { scriptedHuntingOnly: true, huntingCap: 1 });
    f.forceHunt();
    expect(f.state).toBe("Hunting");
    expect(f.huntCount).toBe(1);
    f.reset();
    f.forceHunt();
    expect(f.state).not.toBe("Hunting"); // cap reached
  });

  it("emits entity.statechange on transitions", () => {
    const bus = new EventBus();
    const f = new ThreatFSM(bus);
    const seen: string[] = [];
    bus.on("entity.statechange", (e) => seen.push(`${e.from}->${e.to}`));
    f.step(0.4, 0);
    f.step(0.7, 0);
    expect(seen).toEqual(["Dormant->Stirring", "Stirring->Alerted"]);
  });
});
