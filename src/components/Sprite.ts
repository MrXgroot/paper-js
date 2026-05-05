import { Component, ComponentType } from "../ecs/Component";

export class Sprite implements Component {
  type: ComponentType = "sprite";
  constructor(
    public width: number,
    public height: number,
    public color: string,
  ) {}
}
