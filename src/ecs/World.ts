import { Component, ComponentType } from "./Component";
import { EngineConfig } from "../utils/EngineConfig";
export type Entity = number;

export class World {
  private nextEntityId = 0;
  private entities = new Set<Entity>();
  private components = new Map<ComponentType, Map<Entity, any>>();
  public debugMode: boolean = EngineConfig.debug.enabled;

  createEntity(): Entity {
    const entity = this.nextEntityId++;
    this.entities.add(entity);
    return entity;
  }
  clear() {
    this.entities = new Set<Entity>();
    this.nextEntityId = 0;
    this.components = new Map<ComponentType, Map<Entity, any>>();
  }
  addComponent(entity: Entity, component: Component) {
    if (!this.components.has(component.type)) {
      this.components.set(component.type, new Map());
    }
    this.components.get(component.type)?.set(entity, component);
  }

  getComponent<T>(entity: Entity, type: ComponentType): T | undefined {
    return this.components.get(type)?.get(entity);
  }

  query(...types: ComponentType[]): Entity[] {
    return Array.from(this.entities).filter((entity) => types.every((type) => this.components.get(type)?.has(entity)));
  }
}
