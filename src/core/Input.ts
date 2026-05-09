export class Input {
  private keys = new Set<string>();
  private pressedThisFrame = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  pointerLocked = false;

  private element: HTMLElement;
  private accumDX = 0;
  private accumDY = 0;

  constructor(element: HTMLElement) {
    this.element = element;

    window.addEventListener("keydown", (e) => {
      if (!this.keys.has(e.code)) this.pressedThisFrame.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.element;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      this.accumDX += e.movementX;
      this.accumDY += e.movementY;
    });
  }

  requestPointerLock(): void {
    this.element.requestPointerLock();
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  /** Called once per frame after all systems have read input. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.mouseDX = this.accumDX;
    this.mouseDY = this.accumDY;
    this.accumDX = 0;
    this.accumDY = 0;
  }

  /** Move axis: -1..1 from WASD. */
  axes(): { x: number; z: number; sprint: boolean } {
    let x = 0;
    let z = 0;
    if (this.isDown("KeyW")) z -= 1;
    if (this.isDown("KeyS")) z += 1;
    if (this.isDown("KeyA")) x -= 1;
    if (this.isDown("KeyD")) x += 1;
    if (x !== 0 && z !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      z *= inv;
    }
    return { x, z, sprint: this.isDown("ShiftLeft") || this.isDown("ShiftRight") };
  }
}
