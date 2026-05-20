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

  insert(world: World, entity: Entity) {
    const t = world.getComponent<Transform>(entity, "transform")!;
    const c = world.getComponent<Collider>(entity, "collider")!;
    const bounds = this.getBounds(t, c);

    // Find the bounding box of the entity in grid coordinates
    const startX = Math.floor(bounds.minX / this.cellSize);
    const endX = Math.floor(bounds.maxX / this.cellSize);
    const startY = Math.floor(bounds.minY / this.cellSize);
    const endY = Math.floor(bounds.maxY / this.cellSize);

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
    const bounds = this.getBounds(t, c);

    const startX = Math.floor(bounds.minX / this.cellSize);
    const endX = Math.floor(bounds.maxX / this.cellSize);
    const startY = Math.floor(bounds.minY / this.cellSize);
    const endY = Math.floor(bounds.maxY / this.cellSize);

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

  private getBounds(t: Transform, c: Collider): { minX: number; minY: number; maxX: number; maxY: number } {
    if (c.shape === "circle") {
      const r = c.width / 2;
      return { minX: t.position.x - r, minY: t.position.y - r, maxX: t.position.x + r, maxY: t.position.y + r };
    }

    if (c.vertices.length > 0) {
      const cos = Math.cos(t.angle);
      const sin = Math.sin(t.angle);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const v of c.vertices) {
        const x = t.position.x + v.x * cos - v.y * sin;
        const y = t.position.y + v.x * sin + v.y * cos;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      return { minX, minY, maxX, maxY };
    }

    const cos = Math.abs(Math.cos(t.angle));
    const sin = Math.abs(Math.sin(t.angle));
    const halfWidth = (c.width / 2) * cos + (c.height / 2) * sin;
    const halfHeight = (c.width / 2) * sin + (c.height / 2) * cos;
    return {
      minX: t.position.x - halfWidth,
      minY: t.position.y - halfHeight,
      maxX: t.position.x + halfWidth,
      maxY: t.position.y + halfHeight,
    };
  }
}
