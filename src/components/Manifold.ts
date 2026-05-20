import { Vector2D } from "../core/Vector2D";
import { Entity } from "../ecs/World";

export interface ContactManifold {
  entityA: Entity;
  entityB: Entity;
  normal: Vector2D;
  depth: number;
  contacts: Vector2D[];
}
