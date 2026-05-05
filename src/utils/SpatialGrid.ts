import { World, Entity } from "../ecs/World";
import { Transform } from "../components/Transform";
import { Collider } from "../components/Collider";

export class SpatialGrid {
  private cellSize: number;
  // Map key: "x,y" coordinate string, Value: Set of entity IDs
  private cells: Map<string, Entity[]> = new Map();

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  clear() {
    this.cells.clear();
  }

  // Convert world position to a grid key string "x,y"
  private getKey(x: number, y: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  insert(world: World, entity: Entity) {
    const t = world.getComponent<Transform>(entity, "transform")!;
    const c = world.getComponent<Collider>(entity, "collider")!;

    // Find the bounding box of the entity in grid coordinates
    const startX = Math.floor((t.position.x - c.width / 2) / this.cellSize);
    const endX = Math.floor((t.position.x + c.width / 2) / this.cellSize);
    const startY = Math.floor((t.position.y - c.height / 2) / this.cellSize);
    const endY = Math.floor((t.position.y + c.height / 2) / this.cellSize);

    // Add entity to every cell it overlaps
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`;
        if (!this.cells.has(key)) {
          this.cells.set(key, []);
        }
        this.cells.get(key)!.push(entity);
      }
    }
  }

  getPotentialColliders(world: World, entity: Entity): Set<Entity> {
    const t = world.getComponent<Transform>(entity, "transform")!;
    const c = world.getComponent<Collider>(entity, "collider")!;
    const potential = new Set<Entity>();

    const startX = Math.floor((t.position.x - c.width / 2) / this.cellSize);
    const endX = Math.floor((t.position.x + c.width / 2) / this.cellSize);
    const startY = Math.floor((t.position.y - c.height / 2) / this.cellSize);
    const endY = Math.floor((t.position.y + c.height / 2) / this.cellSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`;
        const cellEntities = this.cells.get(key);
        if (cellEntities) {
          for (const other of cellEntities) {
            if (other !== entity) {
              potential.add(other);
            }
          }
        }
      }
    }
    return potential;
  }
}
