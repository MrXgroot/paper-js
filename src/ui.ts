import { EngineConfig } from "./utils/EngineConfig";

export function initializeUI(onReload: () => void) {
  // Debug Toggle
  document.getElementById("debug-toggle")?.addEventListener("change", (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    EngineConfig.debug.enabled = isChecked;
    document.body.classList.toggle("debug", isChecked);
  });

  // Particle Count
  document.getElementById("particle-count-slider")?.addEventListener("change", (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    EngineConfig.world.particleCount = val;
    const label = document.getElementById("particle-count");
    if (label) label.innerHTML = val.toString();
  });

  // Physics Substepping
  document.getElementById("substep-slider")?.addEventListener("input", (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    EngineConfig.physics.subSteps = val;
    const label = document.getElementById("substep-val");
    if (label) label.innerText = val.toString();
  });

  // Reload Button
  document.getElementById("reload")?.addEventListener("click", onReload);

  // Velocity Visualization
  document.getElementById("show-vel")?.addEventListener("change", (e) => {
    EngineConfig.debug.showVelocity = (e.target as HTMLInputElement).checked;
  });

  document.getElementById("show-aabb")?.addEventListener("change", (e) => {
    EngineConfig.debug.showBoundingBox = (e.target as HTMLInputElement).checked;
  });
}
