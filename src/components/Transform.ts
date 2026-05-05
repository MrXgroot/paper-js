import { Component, ComponentType } from "../ecs/Component";
import { Vector2D } from "../core/Vector2D";

export class Transform implements Component {
  type: ComponentType = "transform";
  constructor(
    public position: Vector2D = new Vector2D(0, 0),
    public angle: number = 0,
  ) {}
}
