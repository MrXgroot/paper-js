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
document.getElementById("debug-toggle")?.addEventListener("change", (e) => {
  EngineConfig.debug.enabled = (e.target as HTMLInputElement).checked;
  world.debugMode = EngineConfig.debug.enabled; // Sync with ECS world
});

document.getElementById("bounce-slider")?.addEventListener("change", (e) => {
  const val = parseInt((e.target as HTMLInputElement).value);
  EngineConfig.physics.bounce = val / 100;
  document.getElementById("bounce-val")!.innerHTML = val.toString();
});
document.getElementById("show-vel")?.addEventListener("change", (e) => {
  EngineConfig.debug.showVelocity = (e.target as HTMLInputElement).checked;
});

document.getElementById("substep-slider")?.addEventListener("input", (e) => {
  const val = parseInt((e.target as HTMLInputElement).value);
  EngineConfig.physics.subSteps = val;
  document.getElementById("substep-val")!.innerText = val.toString();
});

document.getElementById("reload")?.addEventListener("click", () => {
  reload();
});

const canvas = document.getElementById("game") as HTMLCanvasElement;
const world = new World();
const renderer = new RenderSystem(canvas);
const physics = new PhysicsSystem();
const collision = new CollisionSystem();

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

function createBody(x: number, y: number, w: number, h: number, color: string, isStatic: boolean = false, bounce: number = 0) {
  const entity = world.createEntity();

  const t = new Transform(new Vector2D(x, y));
  world.addComponent(entity, t);
  world.addComponent(entity, new Sprite(w, h, color));

  const p = new Physics(new Vector2D(0, 0));
  world.addComponent(entity, p);

  const c = new Collider(w, h);

  c.bounce = bounce;
  c.isStatic = isStatic;
  world.addComponent(entity, c);

  return entity;
}

function createEnvironment() {
  const thickness = 100;
  createBody(CANVAS_WIDTH / 2, CANVAS_HEIGHT - thickness - 20, CANVAS_WIDTH * 2, thickness, "#2a2a2a", true);
  createBody(-thickness + 70, CANVAS_HEIGHT / 2, thickness, CANVAS_HEIGHT * 2, "#2c3e50", true);
  createBody(CANVAS_WIDTH - 170, CANVAS_HEIGHT / 2, thickness, CANVAS_HEIGHT * 2, "#2c3e50", true);
  createBody(200, 300, 40, 20, "#34495e", true, 0);
  createBody(280, 360, 40, 20, "#34495e", true, 0);
  createBody(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 200, 20, "#34495e", true, 0);
}

function spawnDebris(count: number, bounce: number = 0) {
  for (let i = 0; i < count; i++) {
    const w = 30;
    const h = 30;
    const x = Math.random() * 500;
    const y = Math.random() * -500;

    const color = `hsl(${Math.random() * 360}, 70%, 60%)`;
    createBody(x, y, w, h, color, false, bounce);
  }
}

function reload() {
  world.clear();
  createEnvironment();
  spawnDebris(EngineConfig.world.particleCount, EngineConfig.physics.bounce);
}
createEnvironment();
spawnDebris(1, 0.5);

let lastTime = performance.now();
let animationId: number;
function loop(currentTime: number) {
  //phsyics update
  let dt = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  physics.update(world, dt);

  //substepping for collission
  const subSteps = EngineConfig.physics.subSteps;
  for (let i = 0; i < subSteps; i++) {
    collision.update(world, dt / subSteps);
  }

  //rendering
  renderer.update(world);
  animationId = requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

//@ts-ignore
if (import.meta.hot) {
  //@ts-ignore
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(animationId);
  });
}
