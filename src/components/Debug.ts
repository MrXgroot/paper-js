import { Vector2D } from "../core/Vector2D";
import { Component, ComponentType } from "../ecs/Component";
export class Debug implements Component {
  type: ComponentType = "debug";
  public contactPoint: Vector2D = new Vector2D(-10, -10);
}
