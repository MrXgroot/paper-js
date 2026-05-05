import { Component, ComponentType } from "../ecs/Component";

export class Collider {
  type: ComponentType = "collider";
  constructor(
    public width: number,
    public height: number,
    public isStatic: boolean = false,
    public bounce: number = 0.5,
  ) {}
}
