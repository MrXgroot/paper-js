import { World } from "./ecs/World";
import { RenderSystem } from "./systems/RenderSystem";
import { PhysicsSystem } from "./systems/PhysicsSystem";
import { Transform } from "./components/Transform";
import { Sprite } from "./components/Sprite";
import { Physics } from "./components/Physics";
import { Vector2D } from "./core/Vector2D";
import { CollisionSystem } from "./systems/CollisionSystem";
import { Collider } from "./components/Collider";
import { EngineConfig } from "./utils/EngineConfig";
import { initializeUI } from "./ui";

//---Core Engine setup-----
const canvas = document.getElementById("game") as HTMLCanvasElement;
const world = new World();
const renderer = new RenderSystem(canvas);
const physics = new PhysicsSystem();
const collision = new CollisionSystem();

let lastTime = performance.now();
let animationId: number;

const isMobile = window.innerWidth < 768;

function createBody(x: number, y: number, w: number, h: number, color: string, isStatic = false, bounce = 0) {
  const entity = world.createEntity();
  world.addComponent(entity, new Transform(new Vector2D(x, y)));
  world.addComponent(entity, new Sprite(w, h, color));
  world.addComponent(entity, new Physics(new Vector2D(0, 0)));

  const c = new Collider(w, h);
  c.bounce = bounce;
  c.isStatic = isStatic;
  world.addComponent(entity, c);

  return entity;
}

//Environment-setup
function createEnvironment() {
  const w = canvas.width;
  const h = canvas.height;
  const thickness = 60;
  const isMobile = w < 768;

  // --- Boundaries ---
  createBody(w / 2, h, w * 2, thickness, "#2c3e50", true);
  createBody(0, h / 2, thickness, h * 2, "#2c3e50", true);
  createBody(w, h / 2, thickness, h * 2, "#2c3e50", true);
  if (isMobile) {
    createBody(w * 0.5, h * 0.6, w * 0.4, 30, "#34495e", true);
  } else {
    const platformWidth = w * 0.2;
    const platformHeight = 30;

    createBody(w * 0.25, h * 0.4, platformWidth, platformHeight, "#34495e", true);
    createBody(w * 0.5, h * 0.65, platformWidth, platformHeight, "#34495e", true);
    createBody(w * 0.75, h * 0.4, platformWidth, platformHeight, "#34495e", true);
  }
}

function spawnDebris() {
  const count = EngineConfig.world.particleCount;
  const bounce = EngineConfig.physics.bounce;

  for (let i = 0; i < count; i++) {
    const size = 30;
    const x = Math.random() * (canvas.width - size) + size / 2;
    const y = Math.random() * -800;
    const color = `hsl(${Math.random() * 360}, 70%, 60%)`;
    createBody(x, y, size, size, color, false, bounce);
  }
}

function reload() {
  world.clear();
  resizeCanvas();
  createEnvironment();
  spawnDebris();
}

function loop(currentTime: number) {
  const dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  //1. physics - integration
  physics.update(world, dt);

  //2. substepping for collission
  const subSteps = EngineConfig.physics.subSteps;
  const subDt = dt / subSteps;
  for (let i = 0; i < subSteps; i++) {
    collision.update(world, subDt);
  }

  // 3. Render
  renderer.update(world);
  animationId = requestAnimationFrame(loop);
}

// --- Initialization ---
window.addEventListener("resize", reload);
initializeUI(reload);
reload();
requestAnimationFrame(loop);

//HMR Cleanup
//@ts-ignore
if (import.meta.hot) {
  //@ts-ignore
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(animationId);
  });
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
