export class Time {
  dt = 0;
  elapsed = 0;
  frame = 0;

  tick(dt: number): void {
    this.dt = dt;
    this.elapsed += dt;
    this.frame++;
  }
}
