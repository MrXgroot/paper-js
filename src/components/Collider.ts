import { Component, ComponentType } from "../ecs/Component";
import { Vector2D } from "../core/Vector2D";

export type ColliderShape = "box" | "circle" | "polygon" | "line";

export class Collider {
  type: ComponentType = "collider";
  constructor(
    public width: number,
    public height: number,
    public isStatic: boolean = false,
    public bounce: number = 0.5,
    public friction: number = 0.4,
    public shape: ColliderShape = "box",
    public vertices: Vector2D[] = [],
  ) {}
}
