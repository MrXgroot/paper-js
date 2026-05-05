export type ComponentType = "transform" | "sprite" | "physics" | "collider" | "debug";

export interface Component {
  type: ComponentType;
}
