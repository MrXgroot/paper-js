import { World } from "../ecs/World";
import { Transform } from "../components/Transform";
import { Physics } from "../components/Physics";
import { Vector2D } from "../core/Vector2D";
import { Collider } from "../components/Collider";
export class PhysicsSystem {
  private gravity = new Vector2D(0, 981); // Standard gravity

  update(world: World, deltaTime: number) {
    const entities = world.query("transform", "collider", "physics");

    for (const entity of entities) {
      const transform = world.getComponent<Transform>(entity, "transform")!;
      const physics = world.getComponent<Physics>(entity, "physics")!;
      const collider = world.getComponent<Collider>(entity, "collider")!;

      //skip static bodies
      if (collider.isStatic) continue;

      // 1. Apply Gravity to acceleration
      const gravityForce = this.gravity.clone().scale(physics.gravityScale * deltaTime);
      physics.velocity.add(gravityForce);

      // 2. Update Velocity (v = u + at)
      const stepAcceleration = physics.acceleration.clone().scale(deltaTime);
      physics.velocity.add(stepAcceleration);

      // 3. Update Position (s = s + vt)
      const stepVelocity = physics.velocity.clone().scale(deltaTime);
      transform.position.add(stepVelocity);

      // 4. Reset acceleration for next frame
      const inertia = physics.inertia > 0 ? physics.inertia : 1000;

      //angular motions
      const angularAccel = physics.torque / inertia;
      physics.angularVelocity += angularAccel * deltaTime;
      transform.angle += physics.angularVelocity * deltaTime;

      //damping cleaning for the next frame
      const damping = Math.pow(0.995, deltaTime * 60);
      physics.velocity.scale(0.991);

      physics.angularVelocity *= damping;

      //resetting for the next frane
      physics.acceleration.set(0, 0);
      physics.torque = 0;
    }
  }
}
