/** Ending title card + film look (vignette, grain). */
import { FONT, H, W } from "./constants";
import { rng } from "./math";
import type { Settings } from "../project/types";

function makeVignette() {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d")!;
  c.setTransform(1, 0, 0, 1.3, 0, 0);
  const g = c.createRadialGradient(540, 920 / 1.3, 340, 540, 920 / 1.3, 1000);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,.85)");
  c.fillStyle = g; c.fillRect(0, 0, W, H / 1.3 + 10);
  return cv;
}

function makeGrain(seed: number) {
  const cv = document.createElement("canvas");
  cv.width = 270; cv.height = 480;
  const c = cv.getContext("2d")!, img = c.createImageData(270, 480), r = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return cv;
}

export class Stage {
  private vignette = makeVignette();
  private grain = Array.from({ length: 6 }, (_, k) => makeGrain(k * 977 + 5));

  /** Closing title card on black, like the end of a film. */
  drawTitle(c: CanvasRenderingContext2D, alpha: number, s: Settings) {
    if (alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = `800 72px ${FONT}`; c.fillStyle = "#e6e8ec"; c.letterSpacing = "16px";
    c.fillText(s.ending.title, W / 2 + 8, H / 2 - 30);
    c.fillStyle = "#3a3d44"; c.fillRect(W / 2 - 60, H / 2 + 30, 120, 2);
    c.font = `500 26px ${FONT}`; c.fillStyle = "#7f858e"; c.letterSpacing = "3px";
    c.fillText(s.ending.subtitle, W / 2, H / 2 + 80);
    c.restore();
  }

  drawFilmLook(c: CanvasRenderingContext2D, frame: number, grain: number) {
    c.drawImage(this.vignette, 0, 0);
    if (grain <= 0) return;
    c.globalAlpha = grain;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.grain[frame % this.grain.length], 0, 0, W, H);
    c.imageSmoothingEnabled = true;
    c.globalAlpha = 1;
  }
}
