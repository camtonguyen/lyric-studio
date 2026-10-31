/**
 * Minimal page for the Node renderer: no UI, just the engine.
 * scripts/render.mjs calls window.lyricStudio.load(project) then frame(t) for every frame.
 */
import { Renderer, buildModel, loadCover, loadFonts } from "../engine";
import { normalizeProject } from "../project/defaults";

declare global {
  interface Window {
    lyricStudio?: {
      load(project: unknown, width?: number): Promise<{ duration: number; fps: number }>;
      frame(t: number): string;
    };
  }
}

export async function startHeadless() {
  document.body.style.margin = "0";
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  await loadFonts();
  const renderer = new Renderer(canvas);

  window.lyricStudio = {
    async load(project, width = 1080) {
      const model = buildModel(normalizeProject(project));
      await loadCover(model.settings.cover);
      renderer.setResolution(width);
      renderer.setModel(model);
      return { duration: model.settings.duration, fps: 30 };
    },
    frame(t) {
      renderer.render(t);
      return canvas.toDataURL("image/jpeg", 0.93);
    },
  };
}
