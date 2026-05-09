type UpdateFn = (dt: number) => void;
type RenderFn = (alpha: number) => void;

const FIXED_DT = 1 / 60;
const MAX_STEPS = 5;

export class GameLoop {
  private acc = 0;
  private last = 0;
  private running = false;

  constructor(private update: UpdateFn, private render: RenderFn) {}

  start(): void {
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    this.acc += Math.min(elapsed, 0.25);

    let steps = 0;
    while (this.acc >= FIXED_DT && steps < MAX_STEPS) {
      this.update(FIXED_DT);
      this.acc -= FIXED_DT;
      steps++;
    }

    const alpha = this.acc / FIXED_DT;
    this.render(alpha);
    requestAnimationFrame(this.frame);
  };
}
