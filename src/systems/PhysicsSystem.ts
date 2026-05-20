import { World } from "../ecs/World";
import { Transform } from "../components/Transform";
import { Physics } from "../components/Physics";
import { Collider } from "../components/Collider";
import { EngineConfig } from "../utils/EngineConfig";

interface SleepState {
  calmTime: number;
  isSleeping: boolean;
}

export class PhysicsSystem {
  private readonly sleepStates = new Map<number, SleepState>();

  reset(): void {
    this.sleepStates.clear();
  }

  isSleeping(entityId: number): boolean {
    return this.sleepStates.get(entityId)?.isSleeping ?? false;
  }

  wake(world: World, entityId: number): void {
    const state = this.sleepStates.get(entityId);
    if (state) {
      state.isSleeping = false;
      state.calmTime = 0;
    }

    const physics = world.getComponent<Physics>(entityId, "physics");
    if (physics) {
      physics.isSleeping = false;
      physics.sleepTimer = 0;
    }
  }

  update(world: World, dt: number): void {
    const entities = world.query("transform", "collider", "physics");
    const config = EngineConfig.physics;

    for (const entity of entities) {
      const transform = world.getComponent<Transform>(entity, "transform")!;
      const physics = world.getComponent<Physics>(entity, "physics")!;
      const collider = world.getComponent<Collider>(entity, "collider")!;

      transform.syncPrevious();

      if (collider.isStatic || physics.invMass === 0) {
        physics.velocity.set(0, 0);
        physics.angularVelocity = 0;
        physics.isSleeping = true;
        continue;
      }

      let sleepState = this.sleepStates.get(entity);
      if (!sleepState) {
        sleepState = { calmTime: 0, isSleeping: false };
        this.sleepStates.set(entity, sleepState);
      }

      if (sleepState.isSleeping) {
        physics.isSleeping = true;
        physics.acceleration.set(0, 0);
        physics.torque = 0;
        continue;
      }

      physics.isSleeping = false;

      physics.velocity.x += (config.gravityX * physics.gravityScale + physics.acceleration.x) * dt;
      physics.velocity.y += (config.gravityY * physics.gravityScale + physics.acceleration.y) * dt;

      const inertia = physics.inertia > 0 ? physics.inertia : this.estimateInertia(physics, collider);
      physics.angularVelocity += (physics.torque / inertia) * dt;

      const linearDamping = Math.pow(config.linearDamping, dt * 60);
      const angularDamping = Math.pow(config.angularDamping, dt * 60);
      physics.velocity.scale(linearDamping);
      physics.angularVelocity *= angularDamping;

      transform.position.x += physics.velocity.x * dt;
      transform.position.y += physics.velocity.y * dt;
      transform.angle += physics.angularVelocity * dt;

      physics.acceleration.set(0, 0);
      physics.torque = 0;

      this.evaluateSleep(physics, sleepState, dt);
    }

    this.pruneDeadEntities(entities);
  }

  private evaluateSleep(physics: Physics, state: SleepState, dt: number): void {
    const linearSpeedSq = physics.velocity.lengthSq();
    const angularSpeed = Math.abs(physics.angularVelocity);
    const linearLimit = EngineConfig.physics.sleepLinearThreshold;
    const angularLimit = EngineConfig.physics.sleepAngularThreshold;

    if (linearSpeedSq < linearLimit * linearLimit && angularSpeed < angularLimit) {
      state.calmTime += dt;
      if (state.calmTime >= EngineConfig.physics.sleepTimeThreshold) {
        state.isSleeping = true;
        physics.isSleeping = true;
        physics.velocity.set(0, 0);
        physics.angularVelocity = 0;
      }
    } else {
      state.calmTime = 0;
    }
  }

  private estimateInertia(physics: Physics, collider: Collider): number {
    if (physics.invMass === 0) return Number.POSITIVE_INFINITY;
    const mass = 1 / physics.invMass;
    if (collider.shape === "circle") {
      const radius = collider.width / 2;
      return 0.5 * mass * radius * radius;
    }
    return (mass * (collider.width * collider.width + collider.height * collider.height)) / 12;
  }

  private pruneDeadEntities(liveEntities: number[]): void {
    if (this.sleepStates.size <= liveEntities.length) return;
    const liveSet = new Set(liveEntities);
    for (const id of this.sleepStates.keys()) {
      if (!liveSet.has(id)) this.sleepStates.delete(id);
    }
  }
}
