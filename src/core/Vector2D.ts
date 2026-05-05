export class Vector2D {
  constructor(
    public x: number = 0,
    public y: number = 0,
  ) {}

  add(v: Vector2D): Vector2D {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  sub(v: Vector2D): Vector2D {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  scale(s: number): Vector2D {
    this.x *= s;
    this.y *= s;
    return this;
  }
  dot(v: Vector2D): number {
    return this.x * v.x + this.y * v.y;
  }
  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }
  cross(v: Vector2D): number {
    return this.x * v.y - this.y * v.x;
  }
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  set(x: number, y: number): Vector2D {
    this.x = x;
    this.y = y;
    return this;
  }
  lengthSq(): number {
    return this.length() * this.length();
  }

  normalize() {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  perp() {
    return new Vector2D(-this.y, this.x);
  }
}
