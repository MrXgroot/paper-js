import { World, Entity } from "../ecs/World";
import { Collider } from "../components/Collider";
import { Transform } from "../components/Transform";
import { Physics } from "../components/Physics";
import { Vector2D } from "../core/Vector2D";
import { SpatialGrid } from "../utils/SpatialGrid";
import { PhysicsSystem } from "./PhysicsSystem";
import { EngineConfig } from "../utils/EngineConfig";

const BAUMGARTE_FACTOR = 0.24;
const PENETRATION_SLOP = 0.03;
const RESTITUTION_SLOP = 1.0;
const CIRCLE_SEGMENTS = 18;

interface ContactState {
  normalImpulse: number;
  tangentImpulse: number;
}

interface PersistentContact {
  entityA: Entity;
  entityB: Entity;
  normal: Vector2D;
  depth: number;
  contacts: Vector2D[];
  contactStates: ContactState[];
}

export interface CollisionStats {
  broadphasePairs: number;
  collisions: number;
}

export class CollisionSystem {
  private grid = new SpatialGrid(128);
  private contactMap = new Map<string, PersistentContact>();
  private stats: CollisionStats = { broadphasePairs: 0, collisions: 0 };
  private debugContacts: Vector2D[] = [];
  private debugNormals: Array<{ point: Vector2D; normal: Vector2D }> = [];

  constructor(private readonly physicsSystem: PhysicsSystem) {}

  reset(): void {
    this.grid.clear();
    this.contactMap.clear();
    this.debugContacts = [];
    this.debugNormals = [];
    this.stats = { broadphasePairs: 0, collisions: 0 };
  }

  getStats(): CollisionStats {
    return this.stats;
  }

  getDebugContacts(): Vector2D[] {
    return this.debugContacts;
  }

  getDebugNormals(): Array<{ point: Vector2D; normal: Vector2D }> {
    return this.debugNormals;
  }

  update(world: World, dt: number): void {
    const entities = world.query("transform", "collider", "physics");
    const checkedPairs = new Set<string>();
    const activeKeys = new Set<string>();
    const manifolds: PersistentContact[] = [];

    this.stats = { broadphasePairs: 0, collisions: 0 };
    this.debugContacts = [];
    this.debugNormals = [];

    this.grid.clear();
    for (const ent of entities) this.grid.insert(world, ent);

    for (const entityA of entities) {
      const neighbours = this.grid.getPotentialColliders(world, entityA);

      for (const entityB of neighbours) {
        if (entityA === entityB) continue;

        const pairKey = entityA < entityB ? `${entityA}-${entityB}` : `${entityB}-${entityA}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);
        this.stats.broadphasePairs++;

        const cA = world.getComponent<Collider>(entityA, "collider")!;
        const cB = world.getComponent<Collider>(entityB, "collider")!;
        if (cA.isStatic && cB.isStatic) continue;

        const aAsleep = !cA.isStatic && this.physicsSystem.isSleeping(entityA);
        const bAsleep = !cB.isStatic && this.physicsSystem.isSleeping(entityB);
        if (aAsleep && bAsleep) continue;

        const tA = world.getComponent<Transform>(entityA, "transform")!;
        const tB = world.getComponent<Transform>(entityB, "transform")!;
        if (!this.checkAABB(tA, tB, cA, cB)) continue;

        const manifold = this.buildManifold(entityA, entityB, world, pairKey);
        if (!manifold) continue;

        if (aAsleep) this.physicsSystem.wake(world, entityA);
        if (bAsleep) this.physicsSystem.wake(world, entityB);

        activeKeys.add(pairKey);
        manifolds.push(manifold);
      }
    }

    for (const key of this.contactMap.keys()) {
      if (!activeKeys.has(key)) this.contactMap.delete(key);
    }

    this.stats.collisions = manifolds.length;
    for (const manifold of manifolds) this.applyPositionalCorrection(manifold, world);
    for (const manifold of manifolds) this.warmStart(manifold, world);

    for (let iter = 0; iter < EngineConfig.physics.solverIterations; iter++) {
      for (const manifold of manifolds) this.solveVelocity(manifold, world);
    }

    if (EngineConfig.debug.enabled) {
      this.captureDebugData(manifolds);
    }
  }

  private buildManifold(a: Entity, b: Entity, world: World, pairKey: string): PersistentContact | null {
    const tA = world.getComponent<Transform>(a, "transform")!;
    const tB = world.getComponent<Transform>(b, "transform")!;
    const cA = world.getComponent<Collider>(a, "collider")!;
    const cB = world.getComponent<Collider>(b, "collider")!;

    const vertsA = this.getVertices(tA, cA);
    const vertsB = this.getVertices(tB, cB);
    const axes = this.getAxes(vertsA, vertsB);

    let minOverlap = Infinity;
    let smallestAxis = new Vector2D();

    for (const axis of axes) {
      const p1 = this.project(vertsA, axis);
      const p2 = this.project(vertsB, axis);

      if (p1.max < p2.min || p2.max < p1.min) return null;

      const overlap = Math.min(p1.max, p2.max) - Math.max(p1.min, p2.min);
      if (overlap < minOverlap) {
        minOverlap = overlap;
        smallestAxis = axis.clone();
      }
    }

    if (tB.position.clone().sub(tA.position).dot(smallestAxis) < 0) {
      smallestAxis.scale(-1);
    }

    const contacts = this.getManifoldPoints(vertsA, vertsB, smallestAxis);
    if (contacts.length === 0) return null;

    const existing = this.contactMap.get(pairKey);
    const contactStates = contacts.map((_, i) => {
      const prev = existing?.contactStates[i];
      return prev ? { normalImpulse: prev.normalImpulse, tangentImpulse: prev.tangentImpulse } : { normalImpulse: 0, tangentImpulse: 0 };
    });

    const manifold: PersistentContact = {
      entityA: a,
      entityB: b,
      normal: smallestAxis,
      depth: minOverlap,
      contacts,
      contactStates,
    };

    this.contactMap.set(pairKey, manifold);
    return manifold;
  }

  private applyPositionalCorrection(m: PersistentContact, world: World): void {
    const pA = world.getComponent<Physics>(m.entityA, "physics")!;
    const pB = world.getComponent<Physics>(m.entityB, "physics")!;
    const tA = world.getComponent<Transform>(m.entityA, "transform")!;
    const tB = world.getComponent<Transform>(m.entityB, "transform")!;
    const cA = world.getComponent<Collider>(m.entityA, "collider")!;
    const cB = world.getComponent<Collider>(m.entityB, "collider")!;

    const invMassA = cA.isStatic ? 0 : pA.invMass;
    const invMassB = cB.isStatic ? 0 : pB.invMass;
    const totalInvMass = invMassA + invMassB;
    if (totalInvMass === 0) return;

    const correctionMag = (Math.max(m.depth - PENETRATION_SLOP, 0) / totalInvMass) * BAUMGARTE_FACTOR;
    const correctionX = m.normal.x * correctionMag;
    const correctionY = m.normal.y * correctionMag;

    if (!cA.isStatic) {
      tA.position.x -= correctionX * invMassA;
      tA.position.y -= correctionY * invMassA;
    }
    if (!cB.isStatic) {
      tB.position.x += correctionX * invMassB;
      tB.position.y += correctionY * invMassB;
    }
  }

  private warmStart(m: PersistentContact, world: World): void {
    const pA = world.getComponent<Physics>(m.entityA, "physics")!;
    const pB = world.getComponent<Physics>(m.entityB, "physics")!;
    const tA = world.getComponent<Transform>(m.entityA, "transform")!;
    const tB = world.getComponent<Transform>(m.entityB, "transform")!;
    const cA = world.getComponent<Collider>(m.entityA, "collider")!;
    const cB = world.getComponent<Collider>(m.entityB, "collider")!;

    const invMassA = cA.isStatic ? 0 : pA.invMass;
    const invMassB = cB.isStatic ? 0 : pB.invMass;
    const invInertiaA = cA.isStatic ? 0 : this.getInvInertia(pA, cA);
    const invInertiaB = cB.isStatic ? 0 : this.getInvInertia(pB, cB);
    const tangent = new Vector2D(-m.normal.y, m.normal.x);
    const scale = 1 / Math.max(m.contacts.length, 1);

    for (let i = 0; i < m.contacts.length; i++) {
      const cs = m.contactStates[i];
      const contact = m.contacts[i];
      const rA = contact.clone().sub(tA.position);
      const rB = contact.clone().sub(tB.position);
      const impulseX = (m.normal.x * cs.normalImpulse + tangent.x * cs.tangentImpulse) * scale;
      const impulseY = (m.normal.y * cs.normalImpulse + tangent.y * cs.tangentImpulse) * scale;
      const impulse = new Vector2D(impulseX, impulseY);

      if (!cA.isStatic) {
        pA.velocity.x -= impulseX * invMassA;
        pA.velocity.y -= impulseY * invMassA;
        pA.angularVelocity -= rA.cross(impulse) * invInertiaA;
      }
      if (!cB.isStatic) {
        pB.velocity.x += impulseX * invMassB;
        pB.velocity.y += impulseY * invMassB;
        pB.angularVelocity += rB.cross(impulse) * invInertiaB;
      }
    }
  }

  private solveVelocity(m: PersistentContact, world: World): void {
    const pA = world.getComponent<Physics>(m.entityA, "physics")!;
    const pB = world.getComponent<Physics>(m.entityB, "physics")!;
    const tA = world.getComponent<Transform>(m.entityA, "transform")!;
    const tB = world.getComponent<Transform>(m.entityB, "transform")!;
    const cA = world.getComponent<Collider>(m.entityA, "collider")!;
    const cB = world.getComponent<Collider>(m.entityB, "collider")!;

    const invMassA = cA.isStatic ? 0 : pA.invMass;
    const invMassB = cB.isStatic ? 0 : pB.invMass;
    if (invMassA + invMassB === 0) return;

    const invInertiaA = cA.isStatic ? 0 : this.getInvInertia(pA, cA);
    const invInertiaB = cB.isStatic ? 0 : this.getInvInertia(pB, cB);
    const tangent = new Vector2D(-m.normal.y, m.normal.x);
    const restitution = this.computeRestitution(cA, cB, pA, pB, tA, tB, m.normal, m.contacts);
    const friction = Math.sqrt(cA.friction * cB.friction);

    for (let i = 0; i < m.contacts.length; i++) {
      const cs = m.contactStates[i];
      const contact = m.contacts[i];
      const rA = contact.clone().sub(tA.position);
      const rB = contact.clone().sub(tB.position);

      const velAX = pA.velocity.x - pA.angularVelocity * rA.y;
      const velAY = pA.velocity.y + pA.angularVelocity * rA.x;
      const velBX = pB.velocity.x - pB.angularVelocity * rB.y;
      const velBY = pB.velocity.y + pB.angularVelocity * rB.x;
      const relVelX = velBX - velAX;
      const relVelY = velBY - velAY;

      const velAlongNormal = relVelX * m.normal.x + relVelY * m.normal.y;
      const rACrossN = rA.cross(m.normal);
      const rBCrossN = rB.cross(m.normal);
      const denomN = invMassA + invMassB + rACrossN * rACrossN * invInertiaA + rBCrossN * rBCrossN * invInertiaB;
      if (denomN === 0) continue;

      let normalImpulse = (-(1 + restitution) * velAlongNormal) / denomN;
      const prevNormalImpulse = cs.normalImpulse;
      cs.normalImpulse = Math.max(prevNormalImpulse + normalImpulse, 0);
      normalImpulse = cs.normalImpulse - prevNormalImpulse;

      const velAlongTangent = relVelX * tangent.x + relVelY * tangent.y;
      const rACrossT = rA.cross(tangent);
      const rBCrossT = rB.cross(tangent);
      const denomT = invMassA + invMassB + rACrossT * rACrossT * invInertiaA + rBCrossT * rBCrossT * invInertiaB;

      let tangentImpulse = 0;
      if (denomT !== 0) {
        const rawTangentImpulse = -velAlongTangent / denomT;
        const maxFriction = cs.normalImpulse * friction;
        const prevTangentImpulse = cs.tangentImpulse;
        cs.tangentImpulse = Math.max(-maxFriction, Math.min(maxFriction, prevTangentImpulse + rawTangentImpulse));
        tangentImpulse = cs.tangentImpulse - prevTangentImpulse;
      }

      const impulseX = m.normal.x * normalImpulse + tangent.x * tangentImpulse;
      const impulseY = m.normal.y * normalImpulse + tangent.y * tangentImpulse;
      const impulse = new Vector2D(impulseX, impulseY);

      if (!cA.isStatic) {
        pA.velocity.x -= impulseX * invMassA;
        pA.velocity.y -= impulseY * invMassA;
        pA.angularVelocity -= rA.cross(impulse) * invInertiaA;
      }
      if (!cB.isStatic) {
        pB.velocity.x += impulseX * invMassB;
        pB.velocity.y += impulseY * invMassB;
        pB.angularVelocity += rB.cross(impulse) * invInertiaB;
      }
    }
  }

  private getInvInertia(physics: Physics, collider: Collider): number {
    if (collider.isStatic || physics.invMass === 0) return 0;
    const mass = 1 / physics.invMass;
    let inertia: number;
    if (collider.shape === "circle") {
      const radius = collider.width / 2;
      inertia = 0.5 * mass * radius * radius;
    } else {
      inertia = (mass * (collider.width * collider.width + collider.height * collider.height)) / 12;
    }
    return inertia > 0 ? 1 / inertia : 0;
  }

  private computeRestitution(cA: Collider, cB: Collider, pA: Physics, pB: Physics, tA: Transform, tB: Transform, normal: Vector2D, contacts: Vector2D[]): number {
    if (contacts.length === 0) return 0;
    const contact = contacts[0];
    const rA = contact.clone().sub(tA.position);
    const rB = contact.clone().sub(tB.position);
    const velAX = pA.velocity.x - pA.angularVelocity * rA.y;
    const velAY = pA.velocity.y + pA.angularVelocity * rA.x;
    const velBX = pB.velocity.x - pB.angularVelocity * rB.y;
    const velBY = pB.velocity.y + pB.angularVelocity * rB.x;
    const relNormalVelocity = (velBX - velAX) * normal.x + (velBY - velAY) * normal.y;

    if (Math.abs(relNormalVelocity) < RESTITUTION_SLOP) return 0;
    return Math.min(cA.bounce, cB.bounce);
  }

  private getVertices(transform: Transform, collider: Collider): Vector2D[] {
    if (collider.shape === "circle") {
      const radius = collider.width / 2;
      const verts: Vector2D[] = [];
      for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
        verts.push(new Vector2D(transform.position.x + Math.cos(angle) * radius, transform.position.y + Math.sin(angle) * radius));
      }
      return verts;
    }

    const localVerts = collider.vertices.length > 0 ? collider.vertices : this.getBoxVertices(collider);
    const cos = Math.cos(transform.angle);
    const sin = Math.sin(transform.angle);

    return localVerts.map((v) => new Vector2D(transform.position.x + v.x * cos - v.y * sin, transform.position.y + v.x * sin + v.y * cos));
  }

  private getBoxVertices(collider: Collider): Vector2D[] {
    const hw = collider.width / 2;
    const hh = collider.height / 2;
    return [new Vector2D(-hw, -hh), new Vector2D(hw, -hh), new Vector2D(hw, hh), new Vector2D(-hw, hh)];
  }

  private getAxes(vertsA: Vector2D[], vertsB: Vector2D[]): Vector2D[] {
    return [...this.getNormals(vertsA), ...this.getNormals(vertsB)];
  }

  private getNormals(verts: Vector2D[]): Vector2D[] {
    const normals: Vector2D[] = [];
    for (let i = 0; i < verts.length; i++) {
      const next = verts[(i + 1) % verts.length];
      normals.push(next.clone().sub(verts[i]).perp().normalize());
    }
    return normals;
  }

  private project(verts: Vector2D[], axis: Vector2D): { min: number; max: number } {
    let min = axis.dot(verts[0]);
    let max = min;
    for (let i = 1; i < verts.length; i++) {
      const p = axis.dot(verts[i]);
      if (p < min) min = p;
      else if (p > max) max = p;
    }
    return { min, max };
  }

  private checkAABB(tA: Transform, tB: Transform, cA: Collider, cB: Collider): boolean {
    const a = this.computeAABB(tA, cA);
    const b = this.computeAABB(tB, cB);
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
  }

  private computeAABB(transform: Transform, collider: Collider): { minX: number; minY: number; maxX: number; maxY: number } {
    if (collider.shape === "circle") {
      const radius = collider.width / 2;
      return {
        minX: transform.position.x - radius,
        minY: transform.position.y - radius,
        maxX: transform.position.x + radius,
        maxY: transform.position.y + radius,
      };
    }

    const verts = this.getVertices(transform, collider);
    let minX = verts[0].x;
    let minY = verts[0].y;
    let maxX = verts[0].x;
    let maxY = verts[0].y;

    for (let i = 1; i < verts.length; i++) {
      const v = verts[i];
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }

    return { minX, minY, maxX, maxY };
  }

  private getManifoldPoints(vertsA: Vector2D[], vertsB: Vector2D[], normal: Vector2D): Vector2D[] {
    const edgeA = this.getSupportEdge(vertsA, normal);
    const edgeB = this.getSupportEdge(vertsB, normal.clone().scale(-1));

    let refEdge = edgeA;
    let incEdge = edgeB;
    let flip = false;

    if (Math.abs(edgeB.dir.dot(normal)) < Math.abs(edgeA.dir.dot(normal))) {
      refEdge = edgeB;
      incEdge = edgeA;
      flip = true;
    }

    const refDir = refEdge.dir.clone().normalize();
    let clipped = this.clip(incEdge.v1, incEdge.v2, refDir, refDir.dot(refEdge.v1));
    if (clipped.length < 2) return clipped.length ? clipped : [];

    clipped = this.clip(clipped[0], clipped[1], refDir.clone().scale(-1), -refDir.dot(refEdge.v2));
    if (clipped.length < 2) return clipped.length ? clipped : [];

    const refNormal = refDir.clone().perp();
    if (flip) refNormal.scale(-1);
    const refDepth = refNormal.dot(refEdge.maxPoint);
    const contacts = clipped.filter((p) => refNormal.dot(p) - refDepth <= 0.05);

    return contacts.length > 0 ? contacts : [refEdge.maxPoint.clone()];
  }

  private getSupportEdge(verts: Vector2D[], normal: Vector2D) {
    let maxDot = -Infinity;
    let index = 0;
    for (let i = 0; i < verts.length; i++) {
      const d = normal.dot(verts[i]);
      if (d > maxDot) {
        maxDot = d;
        index = i;
      }
    }

    const v = verts[index];
    const vPrev = verts[(index + verts.length - 1) % verts.length];
    const vNext = verts[(index + 1) % verts.length];
    const toNext = v.clone().sub(vNext).normalize();
    const toPrev = v.clone().sub(vPrev).normalize();

    if (Math.abs(toNext.dot(normal)) <= Math.abs(toPrev.dot(normal))) {
      return { v1: vNext, v2: v, dir: v.clone().sub(vNext), maxPoint: v };
    }
    return { v1: vPrev, v2: v, dir: v.clone().sub(vPrev), maxPoint: v };
  }

  private clip(v1: Vector2D, v2: Vector2D, normal: Vector2D, offset: number): Vector2D[] {
    const d1 = normal.dot(v1) - offset;
    const d2 = normal.dot(v2) - offset;
    const points: Vector2D[] = [];

    if (d1 >= 0) points.push(v1.clone());
    if (d2 >= 0) points.push(v2.clone());
    if (d1 * d2 < 0) {
      const t = d1 / (d1 - d2);
      points.push(v1.clone().add(v2.clone().sub(v1).scale(t)));
    }

    return points;
  }

  private captureDebugData(manifolds: PersistentContact[]): void {
    for (const manifold of manifolds) {
      for (const contact of manifold.contacts) {
        this.debugContacts.push(contact.clone());
        this.debugNormals.push({ point: contact.clone(), normal: manifold.normal.clone() });
      }
    }
  }
}
