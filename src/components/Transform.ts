import { Component, ComponentType } from "../ecs/Component";
import { Vector2D } from "../core/Vector2D";

export class Transform implements Component {
  type: ComponentType = "transform";
  public previousPosition: Vector2D;
  public previousAngle: number;

  constructor(
    public position: Vector2D = new Vector2D(0, 0),
    public angle: number = 0,
  ) {
    this.previousPosition = position.clone();
    this.previousAngle = angle;
  }

  syncPrevious(): void {
    this.previousPosition.set(this.position.x, this.position.y);
    this.previousAngle = this.angle;
  }
}
