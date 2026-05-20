import { World } from "../ecs/World";
import { Transform } from "../components/Transform";
import { Sprite } from "../components/Sprite";
import { Physics } from "../components/Physics";
import { Collider } from "../components/Collider";
import { EngineConfig } from "../utils/EngineConfig";
import { CollisionSystem } from "./CollisionSystem";

export class RenderSystem {
  private ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }

  get width(): number {
    return this.cssWidth;
  }

  get height(): number {
    return this.cssHeight;
  }

  resize(): void {
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.cssWidth = window.innerWidth;
    this.cssHeight = window.innerHeight;

    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.canvas.width = Math.floor(this.cssWidth * this.dpr);
    this.canvas.height = Math.floor(this.cssHeight * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  update(world: World, alpha: number, collisionSystem: CollisionSystem): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    this.drawBackground();

    if (EngineConfig.debug.enabled && EngineConfig.debug.showGrid) {
      this.drawGrid();
    }

    const entities = world.query("transform", "sprite", "collider");
    for (const entity of entities) {
      const transform = world.getComponent<Transform>(entity, "transform")!;
      const sprite = world.getComponent<Sprite>(entity, "sprite")!;
      const collider = world.getComponent<Collider>(entity, "collider")!;
      const physics = world.getComponent<Physics>(entity, "physics");

      const x = transform.previousPosition.x + (transform.position.x - transform.previousPosition.x) * alpha;
      const y = transform.previousPosition.y + (transform.position.y - transform.previousPosition.y) * alpha;
      const angle = transform.previousAngle + (transform.angle - transform.previousAngle) * alpha;

      this.drawShape(x, y, angle, sprite, collider, physics);

      if (EngineConfig.debug.enabled) {
        this.drawEntityDebug(x, y, angle, transform, collider, physics);
      }
    }

    if (EngineConfig.debug.enabled) {
      this.drawCollisionDebug(collisionSystem);
    }
  }

  private drawBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, this.cssWidth, this.cssHeight);
    gradient.addColorStop(0, "#10131a");
    gradient.addColorStop(0.55, "#151922");
    gradient.addColorStop(1, "#0b0d12");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  }

  private drawShape(x: number, y: number, angle: number, sprite: Sprite, collider: Collider, physics?: Physics): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    this.ctx.shadowColor = `${sprite.color}66`;
    this.ctx.shadowBlur = 16;
    this.ctx.fillStyle = physics?.isSleeping && EngineConfig.debug.showSleeping ? "#75808f" : sprite.color;

    if (collider.shape === "circle") {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, collider.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = "rgba(255,255,255,0.22)";
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(collider.width / 2, 0);
      this.ctx.stroke();
    } else if (collider.vertices.length > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(collider.vertices[0].x, collider.vertices[0].y);
      for (let i = 1; i < collider.vertices.length; i++) {
        this.ctx.lineTo(collider.vertices[i].x, collider.vertices[i].y);
      }
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      this.roundRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height, Math.min(6, sprite.width / 4, sprite.height / 4));
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  private drawEntityDebug(x: number, y: number, angle: number, transform: Transform, collider: Collider, physics?: Physics): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    this.ctx.lineWidth = 1;

    if (EngineConfig.debug.showBoundingBox) {
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = physics?.isSleeping ? "#778394" : "#39d5ff";
      this.ctx.setLineDash([5, 5]);
      if (collider.shape === "circle") {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, collider.width / 2, 0, Math.PI * 2);
        this.ctx.stroke();
      } else if (collider.vertices.length > 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(collider.vertices[0].x, collider.vertices[0].y);
        for (let i = 1; i < collider.vertices.length; i++) this.ctx.lineTo(collider.vertices[i].x, collider.vertices[i].y);
        this.ctx.closePath();
        this.ctx.stroke();
      } else {
        this.ctx.strokeRect(-collider.width / 2, -collider.height / 2, collider.width, collider.height);
      }
    }

    this.ctx.restore();

    if (EngineConfig.debug.showVelocity && physics) {
      this.ctx.save();
      this.ctx.strokeStyle = "#6cffb0";
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([]);
      this.ctx.beginPath();
      this.ctx.moveTo(transform.position.x, transform.position.y);
      this.ctx.lineTo(transform.position.x + physics.velocity.x * 0.08, transform.position.y + physics.velocity.y * 0.08);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  private drawCollisionDebug(collisionSystem: CollisionSystem): void {
    if (EngineConfig.debug.showContacts) {
      this.ctx.save();
      this.ctx.strokeStyle = "#ff5b7c";
      this.ctx.lineWidth = 2;
      for (const point of collisionSystem.getDebugContacts()) {
        this.ctx.beginPath();
        this.ctx.moveTo(point.x - 5, point.y);
        this.ctx.lineTo(point.x + 5, point.y);
        this.ctx.moveTo(point.x, point.y - 5);
        this.ctx.lineTo(point.x, point.y + 5);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    if (EngineConfig.debug.showNormals) {
      this.ctx.save();
      this.ctx.strokeStyle = "#ffd166";
      this.ctx.lineWidth = 1.5;
      for (const item of collisionSystem.getDebugNormals()) {
        this.ctx.beginPath();
        this.ctx.moveTo(item.point.x, item.point.y);
        this.ctx.lineTo(item.point.x + item.normal.x * 28, item.point.y + item.normal.y * 28);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }
  }

  private drawGrid(): void {
    const size = 128;
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255,255,255,0.06)";
    this.ctx.lineWidth = 1;
    for (let x = 0; x <= this.cssWidth; x += size) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.cssHeight);
      this.ctx.stroke();
    }
    for (let y = 0; y <= this.cssHeight; y += size) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.cssWidth, y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }
}
