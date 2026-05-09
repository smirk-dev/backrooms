import { Box3, Vector3 } from "three";

const TMP = new Vector3();

/**
 * Capsule-vs-AABB iterative slide. The player is a vertical capsule of radius `r`
 * and total height `h`. We treat it as a vertical line segment between two spheres
 * centered at (px, py + r, pz) and (px, py + h - r, pz). For axis-aligned walls we
 * only need horizontal sphere-vs-AABB along XZ.
 *
 * This is intentionally simple: the backrooms world is axis-aligned, walking-only,
 * no slopes, no jumping. ~80 lines, no physics library, full control over teleports.
 */
export class CapsuleCollider {
  /** Static world AABBs the capsule collides against. */
  staticBoxes: Box3[] = [];
  radius: number;
  height: number;

  constructor(radius = 0.3, height = 1.75) {
    this.radius = radius;
    this.height = height;
  }

  /**
   * Move `pos` by `delta`, sliding along static AABBs. Mutates `pos` in place.
   * Returns true if any contact occurred.
   */
  move(pos: Vector3, delta: Vector3): boolean {
    let contacted = false;
    // Resolve X then Z separately so we slide along walls cleanly.
    pos.x += delta.x;
    if (this.resolveAxis(pos, "x")) contacted = true;
    pos.z += delta.z;
    if (this.resolveAxis(pos, "z")) contacted = true;
    return contacted;
  }

  /**
   * Push the capsule out of any AABB it overlaps along a single axis.
   * Operates on the horizontal cross-section only (capsule is vertical).
   */
  private resolveAxis(pos: Vector3, axis: "x" | "z"): boolean {
    const r = this.radius;
    let touched = false;

    for (const box of this.staticBoxes) {
      // Vertical overlap?
      const top = pos.y + this.height;
      const bottom = pos.y;
      if (box.max.y < bottom || box.min.y > top) continue;

      // Closest point on AABB (XZ) to capsule center (XZ).
      const cx = clamp(pos.x, box.min.x, box.max.x);
      const cz = clamp(pos.z, box.min.z, box.max.z);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;

      // Inside — push out along resolution axis.
      touched = true;
      const inside = d2 < 1e-8;
      if (inside) {
        // Center is inside the AABB on XZ; push back along the just-moved axis.
        if (axis === "x") {
          const left = pos.x - box.min.x;
          const right = box.max.x - pos.x;
          pos.x += left < right ? -(left + r) : right + r;
        } else {
          const front = pos.z - box.min.z;
          const back = box.max.z - pos.z;
          pos.z += front < back ? -(front + r) : back + r;
        }
      } else {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        // Apply push only along the axis that just moved — preserves slide.
        if (axis === "x") pos.x += dx * push;
        else pos.z += dz * push;
      }
    }
    return touched;
  }

  /** Convenience: tile-coord AABB construction. */
  static box(min: Vector3, max: Vector3): Box3 {
    return new Box3(min.clone(), max.clone());
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Re-export so callers don't need to import three for this.
export { TMP as _scratch };
