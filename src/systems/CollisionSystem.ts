import { World, Entity } from "../ecs/World";
import { Collider } from "../components/Collider";
import { Transform } from "../components/Transform";
import { Physics } from "../components/Physics";
import { Vector2D } from "../core/Vector2D";
import { SpatialGrid } from "../utils/SpatialGrid";
import { Debug } from "../components/Debug";

export class CollisionSystem {
  private grid = new SpatialGrid(128);

  update(world: World, dt: number) {
    const entities = world.query("transform", "collider", "physics");

    this.grid.clear();
    for (const ent of entities) {
      this.grid.insert(world, ent);
    }

    const checkedPairs = new Set<string>();

    for (const entityA of entities) {
      const phys = world.getComponent<Physics>(entityA, "physics")!;
      phys.updateSleepState(dt);

      const neighbours = this.grid.getPotentialColliders(world, entityA);
      for (const entityB of neighbours) {
        if (entityA == entityB) continue;
        const pairKey = entityA < entityB ? `${entityA}-${entityB}` : `${entityB}-${entityA}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        this.checkSAT(entityA, entityB, world);
      }
    }
  }

  private checkSAT(a: Entity, b: Entity, world: World) {
    const tA = world.getComponent<Transform>(a, "transform")!;
    const tB = world.getComponent<Transform>(b, "transform")!;
    const cA = world.getComponent<Collider>(a, "collider")!;
    const cB = world.getComponent<Collider>(b, "collider")!;

    //1. broad phase AABB collision
    if (!this.checkAABB(tA, tB, cA, cB)) {
      return;
    }

    //2. Narrow phase
    const vertsA = this.getVertices(tA, cA);
    const vertsB = this.getVertices(tB, cB);
    const axes = [...this.getNormals(vertsA), ...this.getNormals(vertsB)];

    let minOverlap = Infinity;
    let smallestAxis = new Vector2D();

    for (const axis of axes) {
      const p1 = this.project(vertsA, axis);
      const p2 = this.project(vertsB, axis);

      if (p1.max < p2.min || p2.max < p1.min) return;

      const overlap = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
      if (overlap < minOverlap) {
        minOverlap = overlap;
        smallestAxis = axis;
      }
    }

    //pair direction mismatch correction hardcoding
    const direction = tB.position.clone().sub(tA.position);
    if (direction.dot(smallestAxis) < 0) smallestAxis.scale(-1);
    this.resolveSAT(a, b, world, smallestAxis, minOverlap);
  }

  private resolveSAT(a: Entity, b: Entity, world: World, axis: Vector2D, overlap: number) {
    const pA = world.getComponent<Physics>(a, "physics")!;
    const pB = world.getComponent<Physics>(b, "physics")!;
    const tA = world.getComponent<Transform>(a, "transform")!;
    const tB = world.getComponent<Transform>(b, "transform")!;
    const cA = world.getComponent<Collider>(a, "collider")!;
    const cB = world.getComponent<Collider>(b, "collider")!;

    if (pA.isSleeping && pB.isSleeping) return;
    pA.wakeUp();
    pB.wakeUp();

    const invMassA = cA.isStatic ? 0 : pA?.invMass || 1;
    const invMassB = cB.isStatic ? 0 : pB?.invMass || 1;
    const totalInvMass = invMassA + invMassB;
    if (totalInvMass === 0) return;

    //1. Nudging positional correction

    const slop = 0.05;
    const percent = 0.4;
    const correction = (Math.max(overlap - slop, 0) / totalInvMass) * percent;
    const correctionVec = axis.clone().scale(correction);

    if (!cA.isStatic) tA.position.sub(correctionVec.clone().scale(invMassA));
    if (!cB.isStatic) tB.position.add(correctionVec.clone().scale(invMassB));

    //---2. Impulse setup----
    const contactPoint = this.getContactPoint(this.getVertices(tA, cA), this.getVertices(tB, cB), axis);

    // Calculate rotational inertia
    const invInertiaA = cA.isStatic ? 0 : 1 / ((1 / 12) * (1 / invMassA) * (cA.width ** 2 + cA.height ** 2));
    const invInertiaB = cB.isStatic ? 0 : 1 / ((1 / 12) * (1 / invMassB) * (cB.width ** 2 + cB.height ** 2));

    const rA = contactPoint.clone().sub(tA.position);
    const rB = contactPoint.clone().sub(tB.position);

    // relative velocity at contactpoint angularvelocity
    const vA = pA.velocity.clone().add(new Vector2D(-pA.angularVelocity * rA.y, pA.angularVelocity * rA.x));
    const vB = pB.velocity.clone().add(new Vector2D(-pB.angularVelocity * rB.y, pB.angularVelocity * rB.x));
    const relVel = vB.sub(vA);

    const velAlongNormal = relVel.dot(axis);
    if (velAlongNormal > 0) return;

    //----3. Normal impulse(bounce);
    let e = Math.min(cA.bounce || 0, cB.bounce || 0);
    const rACrossN = rA.cross(axis);
    const rBCrossN = rB.cross(axis);

    const denominator = invMassA + invMassB + rACrossN ** 2 * invInertiaA + rBCrossN ** 2 * invInertiaB;

    let j = -(1 + e) * velAlongNormal;
    j /= denominator;
    const normalImpulse = axis.clone().scale(j);

    //---4. Friction Impulse---
    const tangent = new Vector2D(-axis.y, axis.x);
    const velAlongTangent = relVel.dot(tangent);

    const rACrossT = rA.cross(tangent);
    const rBCrossT = rB.cross(tangent);
    const denomTangent = invMassA + invMassB + rACrossT ** 2 * invInertiaA + rBCrossT ** 2 * invInertiaB;

    let jt = -velAlongTangent;
    jt /= denomTangent;

    //whatever columbs law causing bug
    const mu = 0.3;
    const frictionLimit = j * mu;
    jt = Math.max(-frictionLimit, Math.min(frictionLimit, jt));
    const tangentImpulse = tangent.clone().scale(jt);

    //--------5. Apply final impulse-------
    const finalImpulse = normalImpulse.add(tangentImpulse);

    if (!cA.isStatic) {
      pA.velocity.sub(finalImpulse.clone().scale(invMassA));
      pA.angularVelocity -= rA.cross(finalImpulse) * invInertiaA;
    }
    if (!cB.isStatic) {
      pB.velocity.add(finalImpulse.clone().scale(invMassB));
      pB.angularVelocity += rB.cross(finalImpulse) * invInertiaB;
    }
  }

  private getVertices(t: Transform, c: Collider): Vector2D[] {
    const verts: Vector2D[] = [];
    const cos = Math.cos(t.angle);
    const sin = Math.sin(t.angle);
    const hw = c.width / 2;
    const hh = c.height / 2;

    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];

    return corners.map((p) => new Vector2D(t.position.x + (p.x * cos - p.y * sin), t.position.y + (p.x * sin + p.y * cos)));
  }

  private getNormals(verts: Vector2D[]): Vector2D[] {
    const normals = [];
    for (let i = 0; i < verts.length; i++) {
      const p1 = verts[i];
      const p2 = verts[(i + 1) % verts.length];
      const edge = p2.clone().sub(p1);
      normals.push(edge.perp().normalize());
    }
    return normals;
  }

  private project(verts: Vector2D[], axis: Vector2D) {
    let min = axis.dot(verts[0]);
    let max = min;

    for (let i = 0; i < verts.length; i++) {
      const p = axis.dot(verts[i]);
      min = Math.min(min, p);
      max = Math.max(max, p);
    }
    return { min, max };
  }

  private getContactPoint(vertsA: Vector2D[], vertsB: Vector2D[], axis: Vector2D): Vector2D {
    let bestPoint = vertsA[0];
    let maxDist = -Infinity;

    // We want the vertex of A that is furthest ALONG the axis (hitting B)
    for (const v of vertsA) {
      const dist = v.dot(axis);
      if (dist > maxDist) {
        maxDist = dist;
        bestPoint = v;
      }
    }

    // We also check the vertex of B that is furthest AGAINST the axis (hitting A)
    for (const v of vertsB) {
      const dist = v.dot(axis.clone().scale(-1));
      if (dist > maxDist) {
        maxDist = dist;
        bestPoint = v;
      }
    }

    return bestPoint.clone();
  }
  private checkAABB(tA: Transform, tB: Transform, cA: Collider, cB: Collider): boolean {
    const rectA = {
      left: tA?.position.x - cA.width / 2,
      right: tA?.position.x + cA.width / 2,
      top: tA?.position.y - cA?.height / 2,
      bottom: tA?.position.y + cA.height / 2,
    };

    const rectB = {
      left: tB?.position.x - cB.width / 2,
      right: tB?.position.x + cB.width / 2,
      top: tB?.position.y - cB?.height / 2,
      bottom: tB?.position.y + cB.height / 2,
    };

    return rectA.left < rectB.right && rectA.top < rectB.bottom && rectA.right > rectB.left && rectA.bottom > rectB.top;
  }
}
