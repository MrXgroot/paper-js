import { Component, ComponentType } from "../ecs/Component";
import { Vector2D } from "../core/Vector2D";

export class Physics implements Component {
  type: ComponentType = "physics";
  private readonly SLEEP_THREASHOLD = 0.1;
  private readonly SLEEP_TIME = 1;
  constructor(
    public velocity: Vector2D = new Vector2D(0, 0),
    public acceleration: Vector2D = new Vector2D(0, 0),
    public mass: number = 1,
    public invMass: number = mass == 0 ? 0 : 1 / mass,
    public gravityScale: number = 1,
    public torque: number = 0,
    public inertia: number = 1,
    public angularVelocity: number = 0,
    public isSleeping: boolean = false,
    public sleepTimer: number = 0,
    public fakeColor: string = "#aaa",
  ) {}

  public wakeUp() {
    this.isSleeping = false;
    this.sleepTimer = 0;
  }
  public updateSleepState(dt: number) {
    if (this.invMass === 0) return;

    const energy = this.velocity.length() ** 2 + this.angularVelocity ** 2;
    if (energy < this.SLEEP_THREASHOLD) {
      this.sleepTimer += dt;

      if (this.sleepTimer >= this.SLEEP_TIME) {
        this.fakeColor = "#aaa";
        this.isSleeping = true;
        this.velocity.set(0, 0);
        this.angularVelocity = 0;
      }
    } else {
      this.fakeColor = "#000";
      this.wakeUp();
    }
  }
}
