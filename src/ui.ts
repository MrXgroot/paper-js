import { EngineConfig } from "./utils/EngineConfig";

export interface PlaygroundStats {
  fps: number;
  entities: number;
  collisions: number;
  broadphasePairs: number;
  steps: number;
  paused: boolean;
}

interface UIHandlers {
  onReload: () => void;
  onSceneChange: (scene: string) => void;
  onSpawn: () => void;
  onPauseChange: (paused: boolean) => void;
  onStep: () => void;
  onClear: () => void;
  onDeleteSelected: () => void;
}

export function initializeUI(handlers: UIHandlers): (stats: PlaygroundStats) => void {
  const bindInput = (id: string, callback: (input: HTMLInputElement) => void, eventName = "input") => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    input?.addEventListener(eventName, () => callback(input));
  };

  const bindButton = (id: string, callback: () => void) => {
    document.getElementById(id)?.addEventListener("click", callback);
  };

  bindInput("debug-toggle", (input) => {
    EngineConfig.debug.enabled = input.checked;
    document.body.classList.toggle("debug", input.checked);
  }, "change");

  bindInput("show-vel", (input) => (EngineConfig.debug.showVelocity = input.checked), "change");
  bindInput("show-aabb", (input) => (EngineConfig.debug.showBoundingBox = input.checked), "change");
  bindInput("show-contacts", (input) => (EngineConfig.debug.showContacts = input.checked), "change");
  bindInput("show-normals", (input) => (EngineConfig.debug.showNormals = input.checked), "change");
  bindInput("show-grid", (input) => (EngineConfig.debug.showGrid = input.checked), "change");
  bindInput("show-sleeping", (input) => (EngineConfig.debug.showSleeping = input.checked), "change");

  bindInput("particle-count-slider", (input) => {
    EngineConfig.world.particleCount = parseInt(input.value, 10);
    setText("particle-count", input.value);
  });

  bindInput("solver-slider", (input) => {
    EngineConfig.physics.solverIterations = parseInt(input.value, 10);
    setText("solver-val", input.value);
  });

  bindInput("gravity-slider", (input) => {
    EngineConfig.physics.gravityY = parseInt(input.value, 10);
    setText("gravity-val", input.value);
  });

  bindInput("friction-slider", (input) => {
    EngineConfig.physics.friction = parseInt(input.value, 10) / 100;
    setText("friction-val", EngineConfig.physics.friction.toFixed(2));
  });

  bindInput("bounce-slider", (input) => {
    EngineConfig.physics.bounce = parseInt(input.value, 10) / 100;
    setText("bounce-val", EngineConfig.physics.bounce.toFixed(2));
  });

  bindInput("timescale-slider", (input) => {
    EngineConfig.simulation.timeScale = parseInt(input.value, 10) / 100;
    setText("timescale-val", `${EngineConfig.simulation.timeScale.toFixed(2)}x`);
  });

  const sceneSelect = document.getElementById("scene-select") as HTMLSelectElement | null;
  sceneSelect?.addEventListener("change", () => handlers.onSceneChange(sceneSelect.value));

  const pauseToggle = document.getElementById("pause-toggle") as HTMLInputElement | null;
  pauseToggle?.addEventListener("change", () => handlers.onPauseChange(pauseToggle.checked));

  bindButton("spawn", handlers.onSpawn);
  bindButton("reload", handlers.onReload);
  bindButton("clear", handlers.onClear);
  bindButton("step", handlers.onStep);
  bindButton("delete-selected", handlers.onDeleteSelected);

  syncInitialLabels();

  return (stats: PlaygroundStats) => {
    setText("fps", stats.fps.toString());
    setText("entity-count", stats.entities.toString());
    setText("collision-count", stats.collisions.toString());
    setText("pair-count", stats.broadphasePairs.toString());
    setText("step-count", stats.steps.toString());
    setText("sim-state", stats.paused ? "Paused" : "Running");
    if (pauseToggle && pauseToggle.checked !== stats.paused) pauseToggle.checked = stats.paused;
  };
}

function syncInitialLabels(): void {
  setText("particle-count", EngineConfig.world.particleCount.toString());
  setText("solver-val", EngineConfig.physics.solverIterations.toString());
  setText("gravity-val", EngineConfig.physics.gravityY.toString());
  setText("friction-val", EngineConfig.physics.friction.toFixed(2));
  setText("bounce-val", EngineConfig.physics.bounce.toFixed(2));
  setText("timescale-val", `${EngineConfig.simulation.timeScale.toFixed(2)}x`);
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
