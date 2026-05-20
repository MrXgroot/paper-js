import { World, Entity } from "../ecs/World";
import { Transform } from "../components/Transform";
import { Collider } from "../components/Collider";
import { Physics } from "../components/Physics";
import { Vector2D } from "../core/Vector2D";
import { EngineConfig } from "../utils/EngineConfig";
import { PhysicsSystem } from "./PhysicsSystem";

export class InputSystem {
  private pointer = new Vector2D();
  private pointerVelocity = new Vector2D();
  private lastPointer = new Vector2D();
  private lastMoveTime = performance.now();
  private isPointerDown = false;
  private grabbedEntity: Entity | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly physicsSystem: PhysicsSystem,
    private readonly onEmptyDoubleClick: (x: number, y: number) => void,
  ) {
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerUp);
    canvas.addEventListener("dblclick", this.handleDoubleClick);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  get selectedEntity(): Entity | null {
    return this.grabbedEntity;
  }

  update(world: World, dt: number): void {
    if (!this.isPointerDown || this.grabbedEntity === null) return;

    const transform = world.getComponent<Transform>(this.grabbedEntity, "transform");
    const physics = world.getComponent<Physics>(this.grabbedEntity, "physics");
    const collider = world.getComponent<Collider>(this.grabbedEntity, "collider");
    if (!transform || !physics || !collider || collider.isStatic) return;

    this.physicsSystem.wake(world, this.grabbedEntity);

    const dx = this.pointer.x - transform.position.x;
    const dy = this.pointer.y - transform.position.y;
    physics.velocity.x += dx * EngineConfig.physics.dragStiffness * dt;
    physics.velocity.y += dy * EngineConfig.physics.dragStiffness * dt;

    const drag = Math.max(0, 1 - EngineConfig.physics.dragDamping * dt);
    physics.velocity.scale(drag);
    physics.angularVelocity *= drag;
  }

  deleteSelected(world: World): void {
    if (this.grabbedEntity === null) return;
    world.destroyEntity(this.grabbedEntity);
    this.grabbedEntity = null;
    this.isPointerDown = false;
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.canvas.removeEventListener("dblclick", this.handleDoubleClick);
  }

  bindWorld(world: World): void {
    this.currentWorld = world;
  }

  private currentWorld: World | null = null;

  private handlePointerDown = (event: PointerEvent): void => {
    if (!this.currentWorld) return;
    this.updatePointer(event);
    this.isPointerDown = true;
    this.grabbedEntity = this.pickEntity(this.currentWorld, this.pointer.x, this.pointer.y);
    if (this.grabbedEntity !== null) {
      this.physicsSystem.wake(this.currentWorld, this.grabbedEntity);
      this.canvas.setPointerCapture(event.pointerId);
    }
  };

  private handlePointerMove = (event: PointerEvent): void => {
    this.updatePointer(event);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.currentWorld && this.grabbedEntity !== null) {
      const physics = this.currentWorld.getComponent<Physics>(this.grabbedEntity, "physics");
      const collider = this.currentWorld.getComponent<Collider>(this.grabbedEntity, "collider");
      if (physics && collider && !collider.isStatic) {
        physics.velocity.x += this.pointerVelocity.x * 0.28;
        physics.velocity.y += this.pointerVelocity.y * 0.28;
      }
    }

    this.isPointerDown = false;
    this.grabbedEntity = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private handleDoubleClick = (event: MouseEvent): void => {
    if (!this.currentWorld) return;
    this.updatePointer(event);
    const picked = this.pickEntity(this.currentWorld, this.pointer.x, this.pointer.y);
    if (picked === null) {
      this.onEmptyDoubleClick(this.pointer.x, this.pointer.y);
    }
  };

  private updatePointer(event: MouseEvent | PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const now = performance.now();
    const dt = Math.max((now - this.lastMoveTime) / 1000, 1 / 240);

    this.lastPointer.set(this.pointer.x, this.pointer.y);
    this.pointer.set(event.clientX - rect.left, event.clientY - rect.top);
    this.pointerVelocity.set((this.pointer.x - this.lastPointer.x) / dt, (this.pointer.y - this.lastPointer.y) / dt);
    this.lastMoveTime = now;
  }

  private pickEntity(world: World, x: number, y: number): Entity | null {
    const entities = world.query("transform", "collider", "physics");
    for (let i = entities.length - 1; i >= 0; i--) {
      const entity = entities[i];
      const collider = world.getComponent<Collider>(entity, "collider")!;
      if (collider.isStatic) continue;

      const transform = world.getComponent<Transform>(entity, "transform")!;
      if (this.containsPoint(transform, collider, x, y)) return entity;
    }
    return null;
  }

  private containsPoint(transform: Transform, collider: Collider, x: number, y: number): boolean {
    const dx = x - transform.position.x;
    const dy = y - transform.position.y;

    if (collider.shape === "circle") {
      const radius = collider.width / 2;
      return dx * dx + dy * dy <= radius * radius;
    }

    const cos = Math.cos(-transform.angle);
    const sin = Math.sin(-transform.angle);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    if (collider.vertices.length === 0) {
      return Math.abs(localX) <= collider.width / 2 && Math.abs(localY) <= collider.height / 2;
    }

    let inside = false;
    const verts = collider.vertices;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
      const vi = verts[i];
      const vj = verts[j];
      const intersects = vi.y > localY !== vj.y > localY && localX < ((vj.x - vi.x) * (localY - vi.y)) / (vj.y - vi.y) + vi.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }
}
