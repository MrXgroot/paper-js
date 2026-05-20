import { World, Entity } from "./ecs/World";
import { RenderSystem } from "./systems/RenderSystem";
import { PhysicsSystem } from "./systems/PhysicsSystem";
import { Transform } from "./components/Transform";
import { Sprite } from "./components/Sprite";
import { Physics } from "./components/Physics";
import { Vector2D } from "./core/Vector2D";
import { CollisionSystem } from "./systems/CollisionSystem";
import { Collider, ColliderShape } from "./components/Collider";
import { EngineConfig } from "./utils/EngineConfig";
import { initializeUI, PlaygroundStats } from "./ui";
import { InputSystem } from "./systems/InputSystem";

type SceneId = "sandbox" | "slingshot" | "springs" | "cloth" | "constraints" | "particles" | "stress" | "gravity-well" | "soft-body" | "raycast";

interface BodyOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isStatic?: boolean;
  bounce?: number;
  friction?: number;
  shape?: ColliderShape;
  angle?: number;
  velocity?: Vector2D;
  vertices?: Vector2D[];
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const world = new World();
const renderer = new RenderSystem(canvas);
const physics = new PhysicsSystem();
const collision = new CollisionSystem(physics);
const input = new InputSystem(canvas, physics, (x, y) => spawnShapeAt(x, y));

let lastTime = performance.now();
let accumulator = 0;
let animationId = 0;
let fps = 60;
let framesThisSecond = 0;
let fpsTimer = performance.now();
let stepsLastFrame = 0;

function createBody(options: BodyOptions): Entity {
  const entity = world.createEntity();
  const isStatic = options.isStatic ?? false;
  const mass = isStatic ? 0 : Math.max(0.2, (options.width * options.height) / 1400);
  const invMass = mass === 0 ? 0 : 1 / mass;

  world.addComponent(entity, new Transform(new Vector2D(options.x, options.y), options.angle ?? 0));
  world.addComponent(entity, new Sprite(options.width, options.height, options.color));
  world.addComponent(entity, new Physics(options.velocity ?? new Vector2D(0, 0), new Vector2D(0, 0), mass, invMass));
  world.addComponent(
    entity,
    new Collider(
      options.width,
      options.height,
      isStatic,
      options.bounce ?? EngineConfig.physics.bounce,
      options.friction ?? EngineConfig.physics.friction,
      options.shape ?? "box",
      options.vertices ?? [],
    ),
  );

  return entity;
}

function createEnvironment(): void {
  const w = renderer.width;
  const h = renderer.height;
  const thickness = 80;

  createBody({ x: w / 2, y: h + thickness / 2, width: w * 2, height: thickness, color: "#243040", isStatic: true, friction: 0.8, bounce: 0.15 });
  createBody({ x: -thickness / 2, y: h / 2, width: thickness, height: h * 2, color: "#243040", isStatic: true, friction: 0.8, bounce: 0.15 });
  createBody({ x: w + thickness / 2, y: h / 2, width: thickness, height: h * 2, color: "#243040", isStatic: true, friction: 0.8, bounce: 0.15 });
}

function loadScene(scene: SceneId = EngineConfig.world.scene as SceneId): void {
  EngineConfig.world.scene = scene;
  renderer.resize();
  world.clear();
  physics.reset();
  collision.reset();
  input.bindWorld(world);
  createEnvironment();

  switch (scene) {
    case "slingshot":
      createSlingshotScene();
      break;
    case "springs":
      createSpringScene();
      break;
    case "cloth":
      createClothScene();
      break;
    case "constraints":
      createConstraintScene();
      break;
    case "particles":
      createParticleScene();
      break;
    case "stress":
      createStressScene();
      break;
    case "gravity-well":
      createGravityWellScene();
      break;
    case "soft-body":
      createSoftBodyScene();
      break;
    case "raycast":
      createRaycastScene();
      break;
    default:
      createSandboxScene();
      break;
  }

  syncRuntimeControls();
}

function createSandboxScene(): void {
  const w = renderer.width;
  const h = renderer.height;
  createBody({ x: w * 0.28, y: h * 0.55, width: w * 0.2, height: 26, color: "#3a4a61", isStatic: true, angle: -0.15 });
  createBody({ x: w * 0.72, y: h * 0.42, width: w * 0.18, height: 26, color: "#3a4a61", isStatic: true, angle: 0.18 });

  for (let i = 0; i < EngineConfig.world.particleCount; i++) {
    const size = 22 + Math.random() * 24;
    spawnRandomBody(80 + Math.random() * (w - 160), -600 + Math.random() * 500, size);
  }
}

function createSlingshotScene(): void {
  const w = renderer.width;
  const h = renderer.height;
  createBody({ x: w * 0.18, y: h * 0.7, width: 24, height: 150, color: "#5f6c7b", isStatic: true });
  createBody({ x: w * 0.2, y: h * 0.58, width: 44, height: 44, color: "#ff5b7c", shape: "circle", bounce: 0.4, friction: 0.45 });

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      createBody({ x: w * 0.68 + col * 42, y: h - 55 - row * 38, width: 34, height: 34, color: "#ffd166", friction: 0.72, bounce: 0.05 });
    }
  }
}

function createSpringScene(): void {
  const w = renderer.width;
  for (let i = 0; i < 12; i++) {
    createBody({
      x: w * 0.18 + i * 54,
      y: 110 + Math.sin(i * 0.8) * 32,
      width: 30,
      height: 30,
      color: i % 2 ? "#6cffb0" : "#39d5ff",
      shape: "circle",
      bounce: 0.25,
      friction: 0.35,
    });
  }
}

function createClothScene(): void {
  const startX = renderer.width * 0.28;
  const startY = 95;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 12; x++) {
      createBody({
        x: startX + x * 34,
        y: startY + y * 28,
        width: 15,
        height: 15,
        color: y === 0 ? "#75808f" : "#39d5ff",
        isStatic: y === 0 && x % 3 === 0,
        shape: "circle",
        bounce: 0.05,
        friction: 0.5,
      });
    }
  }
}

function createConstraintScene(): void {
  const w = renderer.width;
  createBody({ x: w * 0.5, y: 110, width: 320, height: 20, color: "#3a4a61", isStatic: true });
  for (let i = 0; i < 14; i++) {
    createBody({ x: w * 0.26 + i * 42, y: 190 + Math.sin(i) * 10, width: 28, height: 28, color: "#a78bfa", shape: "circle", friction: 0.55, bounce: 0.08 });
  }
}

function createParticleScene(): void {
  const w = renderer.width;
  const h = renderer.height;
  for (let i = 0; i < Math.max(140, EngineConfig.world.particleCount * 2); i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 520;
    createBody({
      x: w * 0.5 + Math.cos(angle) * 18,
      y: h * 0.35 + Math.sin(angle) * 18,
      width: 8 + Math.random() * 8,
      height: 8 + Math.random() * 8,
      color: `hsl(${190 + Math.random() * 140}, 80%, 62%)`,
      shape: "circle",
      bounce: 0.65,
      friction: 0.05,
      velocity: new Vector2D(Math.cos(angle) * speed, Math.sin(angle) * speed),
    });
  }
}

function createStressScene(): void {
  const columns = Math.floor(Math.min(24, renderer.width / 34));
  const rows = Math.floor(Math.min(18, renderer.height / 42));
  const startX = renderer.width / 2 - (columns * 28) / 2;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      createBody({ x: startX + x * 30, y: 60 + y * 28, width: 24, height: 24, color: `hsl(${210 + y * 6}, 70%, 58%)`, friction: 0.6, bounce: 0.02 });
    }
  }
}

function createGravityWellScene(): void {
  EngineConfig.physics.gravityY = 0;
  const w = renderer.width;
  const h = renderer.height;
  createBody({ x: w / 2, y: h / 2, width: 58, height: 58, color: "#ffd166", isStatic: true, shape: "circle" });
  for (let i = 0; i < 52; i++) {
    const r = 110 + Math.random() * Math.min(w, h) * 0.35;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.sqrt(130000 / r);
    createBody({
      x: w / 2 + Math.cos(angle) * r,
      y: h / 2 + Math.sin(angle) * r,
      width: 12,
      height: 12,
      color: "#39d5ff",
      shape: "circle",
      friction: 0,
      bounce: 0.9,
      velocity: new Vector2D(-Math.sin(angle) * speed, Math.cos(angle) * speed),
    });
  }
}

function createSoftBodyScene(): void {
  const cx = renderer.width * 0.5;
  const cy = renderer.height * 0.25;
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    createBody({ x: cx + Math.cos(angle) * 80, y: cy + Math.sin(angle) * 80, width: 30, height: 30, color: "#6cffb0", shape: "circle", friction: 0.55, bounce: 0.15 });
  }
  createBody({ x: cx, y: cy, width: 58, height: 58, color: "#2dd4bf", shape: "circle", friction: 0.55, bounce: 0.1 });
}

function createRaycastScene(): void {
  const w = renderer.width;
  const h = renderer.height;
  for (let i = 0; i < 18; i++) {
    createBody({ x: 120 + Math.random() * (w - 240), y: 100 + Math.random() * (h * 0.55), width: 30 + Math.random() * 70, height: 20 + Math.random() * 60, color: "#39d5ff", isStatic: i % 3 === 0, angle: Math.random() * Math.PI, bounce: 0.2 });
  }
}

function spawnRandomBody(x: number, y: number, size: number): void {
  const shape = Math.random() > 0.35 ? "box" : "circle";
  createBody({ x, y, width: size, height: size, color: `hsl(${180 + Math.random() * 170}, 72%, 60%)`, shape, friction: EngineConfig.physics.friction, bounce: EngineConfig.physics.bounce, angle: Math.random() * Math.PI });
}

function spawnShapeAt(x: number, y: number): void {
  const size = 28 + Math.random() * 18;
  spawnRandomBody(x, y, size);
}

function applySceneForces(): void {
  if (EngineConfig.world.scene !== "gravity-well") return;

  const cx = renderer.width / 2;
  const cy = renderer.height / 2;
  const entities = world.query("transform", "physics", "collider");
  for (const entity of entities) {
    const collider = world.getComponent<Collider>(entity, "collider")!;
    if (collider.isStatic) continue;

    const transform = world.getComponent<Transform>(entity, "transform")!;
    const physicsComponent = world.getComponent<Physics>(entity, "physics")!;
    const dx = cx - transform.position.x;
    const dy = cy - transform.position.y;
    const distSq = Math.max(dx * dx + dy * dy, 2800);
    const force = Math.min(2400, 150000 / distSq);
    const invDist = 1 / Math.sqrt(distSq);
    physicsComponent.acceleration.x += dx * invDist * force;
    physicsComponent.acceleration.y += dy * invDist * force;
  }
}

function fixedStep(dt: number): void {
  applySceneForces();
  input.update(world, dt);
  physics.update(world, dt);
  collision.update(world, dt);
}

function loop(currentTime: number): void {
  const rawDelta = Math.min((currentTime - lastTime) / 1000, EngineConfig.simulation.maxFrameDt);
  lastTime = currentTime;
  stepsLastFrame = 0;

  const fixedDt = EngineConfig.simulation.fixedDt;

  if (EngineConfig.simulation.paused) {
    if (EngineConfig.simulation.stepRequested) {
      fixedStep(fixedDt);
      EngineConfig.simulation.stepRequested = false;
      stepsLastFrame = 1;
    }
  } else {
    accumulator += rawDelta * EngineConfig.simulation.timeScale;
    while (accumulator >= fixedDt && stepsLastFrame < EngineConfig.simulation.maxStepsPerFrame) {
      fixedStep(fixedDt);
      accumulator -= fixedDt;
      stepsLastFrame++;
    }
    if (stepsLastFrame >= EngineConfig.simulation.maxStepsPerFrame) {
      accumulator = 0;
    }
  }

  const alpha = EngineConfig.simulation.paused ? 1 : Math.min(accumulator / fixedDt, 1);
  renderer.update(world, alpha, collision);
  updateFrameStats(currentTime);
  animationId = requestAnimationFrame(loop);
}

function updateFrameStats(now: number): void {
  framesThisSecond++;
  if (now - fpsTimer >= 1000) {
    fps = Math.round((framesThisSecond * 1000) / (now - fpsTimer));
    framesThisSecond = 0;
    fpsTimer = now;
  }

  const collisionStats = collision.getStats();
  const stats: PlaygroundStats = {
    fps,
    entities: world.entityCount(),
    collisions: collisionStats.collisions,
    broadphasePairs: collisionStats.broadphasePairs,
    steps: stepsLastFrame,
    paused: EngineConfig.simulation.paused,
  };
  updateStats(stats);
}

function syncRuntimeControls(): void {
  setInputValue("gravity-slider", EngineConfig.physics.gravityY.toString());
  setText("gravity-val", EngineConfig.physics.gravityY.toString());
  setInputValue("particle-count-slider", EngineConfig.world.particleCount.toString());
  setText("particle-count", EngineConfig.world.particleCount.toString());
}

function setInputValue(id: string, value: string): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (input) input.value = value;
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

const updateStats = initializeUI({
  onReload: () => {
    EngineConfig.physics.gravityY = 981;
    loadScene(EngineConfig.world.scene as SceneId);
  },
  onSceneChange: (scene) => {
    EngineConfig.physics.gravityY = 981;
    loadScene(scene as SceneId);
  },
  onSpawn: () => spawnShapeAt(renderer.width * 0.5, 120),
  onPauseChange: (paused) => {
    EngineConfig.simulation.paused = paused;
  },
  onStep: () => {
    EngineConfig.simulation.paused = true;
    EngineConfig.simulation.stepRequested = true;
  },
  onClear: () => loadScene(EngineConfig.world.scene as SceneId),
  onDeleteSelected: () => input.deleteSelected(world),
});

window.addEventListener("resize", () => loadScene(EngineConfig.world.scene as SceneId));

loadScene("sandbox");
requestAnimationFrame(loop);

// @ts-ignore
if (import.meta.hot) {
  // @ts-ignore
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(animationId);
    input.dispose();
  });
}
