/** Full-screen black overlay used for blink-teleports and floor transitions. */
export class Fader {
  private el: HTMLDivElement;

  constructor() {
    this.el = document.createElement("div");
    Object.assign(this.el.style, {
      position: "fixed",
      inset: "0",
      background: "#000",
      opacity: "0",
      pointerEvents: "none",
      transition: "opacity 0.2s linear",
      zIndex: "5",
    });
    document.body.appendChild(this.el);
  }

  /** Fade to black, run `during`, then fade back. */
  async blink(during: () => void | Promise<void>, holdMs = 80): Promise<void> {
    this.el.style.transition = "opacity 0.2s linear";
    this.el.style.opacity = "1";
    await wait(220);
    await during();
    await wait(holdMs);
    this.el.style.opacity = "0";
  }

  /** Slow cinematic fade for floor transitions. */
  async cinematic(during: () => void | Promise<void>, durMs = 1100): Promise<void> {
    this.el.style.transition = `opacity ${durMs}ms ease-in-out`;
    this.el.style.opacity = "1";
    await wait(durMs + 30);
    await during();
    await wait(220);
    this.el.style.opacity = "0";
  }

  /** Lock to fully black (for grab-death). */
  hold(): void {
    this.el.style.transition = "opacity 0.3s linear";
    this.el.style.opacity = "1";
  }
  release(): void {
    this.el.style.opacity = "0";
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
