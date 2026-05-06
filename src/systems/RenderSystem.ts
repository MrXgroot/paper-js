import { World } from "../ecs/World";
import { Transform } from "../components/Transform";
import { Sprite } from "../components/Sprite";
import { Physics } from "../components/Physics";
import { Collider } from "../components/Collider";
import { Debug } from "../components/Debug";
import { EngineConfig } from "../utils/EngineConfig";
export class RenderSystem {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.setupCanvas(canvas);
  }

  private setupCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // CSS size
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Real pixel size
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Reset transforms
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Scale to DPR
    this.ctx.scale(dpr, dpr);

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  update(world: World) {
    //1. Clear screen
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    //Fill background to dark color
    this.ctx.fillStyle = "#1a1a1a";
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    const entities = world.query("transform", "sprite");

    for (const entity of entities) {
      const transform = world.getComponent<Transform>(entity, "transform")!;
      const sprite = world.getComponent<Sprite>(entity, "sprite")!;
      const physics = world.getComponent<Physics>(entity, "physics")!;
      const debugInfo = world.getComponent<Debug>(entity, "debug")!;

      //----PRIMARY RENDERER---
      this.ctx.save();
      this.ctx.translate(transform.position.x, transform.position.y);
      this.ctx.rotate(transform.angle);

      //----Shadow rendering ----- add toggle
      this.ctx.shadowColor = "rgba(0,0,0,0.34)";
      this.ctx.shadowBlur = 20;

      //Main sprite
      this.ctx.fillStyle = sprite.color;

      this.ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
      this.ctx.restore();

      //-----Debug renderer-----

      if (EngineConfig.debug.enabled) {
        this.drawDebugOverlay(transform, sprite, physics, debugInfo);
      }
    }
  }

  private drawDebugOverlay(transform: any, sprite: any, physics: any, debugInfo: any) {
    const { x, y } = transform.position;
    const { width, height } = sprite;

    this.ctx.save();
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.ctx.translate(x, y);
    this.ctx.rotate(transform.angle);

    //-----1.Bounding box overlay------
    if (EngineConfig.debug.showBoundingBox) {
      this.ctx.fillStyle = "rgba(0,0,0,0.5)";
      this.ctx.fillRect(-width / 2, -height / 2, width, height);
      this.ctx.strokeStyle = "#00ffff";
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(-width / 2, -height / 2, width, height);
    }

    //2. Velocity vector
    if (EngineConfig.debug.showVelocity && physics.velocity) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);

      this.ctx.lineTo(physics.velocity.x, physics.velocity.y);
      this.ctx.strokeStyle = " #00fff";
      this.ctx.setLineDash([]);
      this.ctx.stroke();
    }

    //contact pints
    if (EngineConfig.debug.showContacts && debugInfo?.contactPoint) {
      const cp = debugInfo.contactPoint;
      this.ctx.strokeStyle = "#ff4444";
      this.ctx.beginPath();
      this.ctx.moveTo(cp.x - 5, cp.y);
      this.ctx.lineTo(cp.x + 4, cp.y);
      this.ctx.moveTo(cp.x, cp.y - 4);
      this.ctx.lineTo(cp.x, cp.y + 4);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}
