export class Vec2 {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get magnitude() {
    return Math.hypot(this.x, this.y);
  }

  rotate(radians: number): Vec2 {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const nx = this.x * cos - this.y * sin;
    const ny = this.x * sin + this.y * cos;

    this.x = nx;
    this.y = ny;
    return this;
  }

  scale(scalar: number): Vec2 {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  distanceTo(target: Vec2): number {
    return Math.abs(Math.sqrt(Math.pow(this.x - target.x, 2) + Math.pow(this.y - target.y, 2)));
  }

  clampMagnitude(maxMagnitude: number): Vec2 {
    if (maxMagnitude <= 0) return this;

    const mag = this.magnitude;
    if (mag === maxMagnitude) return this;

    const scalar = maxMagnitude / Math.max(mag, maxMagnitude);
    this.scale(scalar);
    return this;
  }

  normalize(): Vec2 {
    if (this.magnitude === 1) return this;
    this.scale(1 / this.magnitude)
    return this;
  }

  copy(): Vec2 {
    return new Vec2(this.x, this.y);
  }

}
