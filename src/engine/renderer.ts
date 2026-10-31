/**
 * Renderer: the only public entry point of the engine.
 *   const r = new Renderer(canvas); r.setModel(buildModel(project)); r.render(t);
 * Composites: 3D editor plane → ending title → vignette + grain.
 */
import { camera, cameraMatrix, cameraSpeed } from "./camera";
import { FPS, H, LINE_H, TOP, W } from "./constants";
import { clamp, prog } from "../shared/math";
import type { Model } from "./model";
import { drawLyricsView } from "./lyricsView";
import { Plane } from "./plane";
import { Stage } from "./stage";
import { Surface } from "./surface";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private plane = new Plane();
  private surface = new Surface(this.plane);
  private stage = new Stage();
  private model: Model | null = null;
  private allocated = { w: 0, h: 0 };

  constructor(private out: HTMLCanvasElement) {
    this.ctx = out.getContext("2d")!;
    this.setResolution(out.width || W);
  }

  /** Output width in pixels (height follows 9:16). */
  setResolution(width: number) {
    this.out.width = width;
    this.out.height = Math.round((width * H) / W);
    this.plane.setOutputSize(this.out.width, this.out.height);
  }

  setModel(m: Model) {
    if (m.editorW !== this.allocated.w || m.editorH !== this.allocated.h) {
      this.plane.allocate(m.editorW, m.editorH);
      this.surface.resize(m.editorW);
      this.allocated = { w: m.editorW, h: m.editorH };
    }
    this.model = m;
    this.surface.invalidate();
  }

  /** Black frame in logical (W×H) units. */
  private clear() {
    const c = this.ctx;
    c.setTransform(this.out.width / W, 0, 0, this.out.height / H, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);
    return c;
  }

  render(t: number) {
    const m = this.model;
    if (!m) return;
    const s = m.settings;
    t = clamp(t, 0, Math.max(0, s.duration - 1e-3));

    const O = s.ending.enabled ? s.ending.at : Infinity;
    const fade = prog(t, O + 1.6, O + 3.0); // editor fades to black
    const titleAlpha = prog(t, O + 3.0, O + 4.2);

    if (s.template !== "code") {
      const c = this.clear();
      drawLyricsView(c, m, t, 1 - fade);
      this.stage.drawTitle(c, titleAlpha, s);
      return;
    }

    const cam = camera(m, t);
    const prev = camera(m, Math.max(0, t - 1 / FPS));
    let motion = clamp(cameraSpeed(cam, prev) * 0.32 - 0.6, 0, 18) * s.style.motionBlur;
    if (t < 0.7) motion += (1 - t / 0.7) * 16 * Math.max(0.3, s.style.motionBlur); // blurry intro

    this.surface.update(m, t);
    this.plane.draw(cameraMatrix(cam), {
      focusLine: (cam.ty - TOP - LINE_H / 2) / LINE_H,
      dof: cam.dof * s.style.depthBlur,
      zoom: cam.zoom,
      motion,
      alpha: 1 - fade,
    });

    const c = this.clear();
    c.drawImage(this.plane.canvas, 0, 0, W, H);
    this.stage.drawTitle(c, titleAlpha, s);
    this.stage.drawFilmLook(c, Math.floor(t * FPS), s.style.grain);
  }
}
