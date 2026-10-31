/**
 * Streaming-app lyrics templates ("apple" = blurred glow + dim/blur lines, "spotify" = solid colour,
 * sung lines turn white). Flat Canvas 2D, drawn straight onto the output (no 3D plane).
 */
import { H, W } from "./constants";
import { easeOut, formatTime, lerp, prog } from "./math";
import type { Model } from "./model";

const LOOK = {
  apple: { family: `-apple-system, "SF Pro Display", "Helvetica Neue", "Segoe UI", Arial, sans-serif`, weight: 700, size: 76, lh: 94, gap: 46, x: 80, anchor: 640 },
  spotify: { family: `"Circular Std", "Gotham", "Helvetica Neue", "Segoe UI", Arial, sans-serif`, weight: 800, size: 66, lh: 80, gap: 44, x: 72, anchor: 560 },
};
const fontOf = (k: (typeof LOOK)["apple"]) => `${k.weight} ${k.size}px ${k.family}`;

/** Cover images by data URL; draws skip a cover that is still decoding (loadCover resolves when ready). */
const covers = new Map<string, HTMLImageElement>();
export function loadCover(src: string): Promise<void> {
  if (!src || covers.has(src)) return Promise.resolve();
  const img = new Image();
  img.src = src;
  covers.set(src, img);
  return img.decode().catch(() => { covers.delete(src); });
}
const MAX_W = W - 160;

interface Layout { rows: string[][]; tops: number[] }
const layouts = new WeakMap<Model, Layout>();

function layout(c: CanvasRenderingContext2D, m: Model): Layout {
  let l = layouts.get(m);
  if (l) return l;
  const k = LOOK[m.settings.template as "apple"] ?? LOOK.apple;
  c.font = fontOf(k);
  const rows: string[][] = [], tops: number[] = [];
  let y = 0;
  m.lyrics.forEach((line, i) => {
    const out: string[] = [];
    let cur = "";
    for (const w of line.raw.split(/\s+/)) {
      if (cur && c.measureText(`${cur} ${w}`).width > MAX_W) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
    }
    out.push(cur);
    if (i && line.verse !== m.lyrics[i - 1].verse) y += k.gap;
    rows.push(out); tops.push(y);
    y += out.length * k.lh + k.gap;
  });
  layouts.set(m, (l = { rows, tops }));
  return l;
}

function background(c: CanvasRenderingContext2D, m: Model, t: number) {
  const color = m.settings.style.lyricsColor;
  if (m.settings.template === "spotify") {
    c.fillStyle = color; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.4)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    return;
  }
  c.fillStyle = "#0b0b0d"; c.fillRect(0, 0, W, H);
  [0.6, 0.4, 0.5].forEach((a, k) => {
    const x = W * (0.5 + 0.45 * Math.sin(t * 0.21 + k * 2.1)), y = H * (0.5 + 0.4 * Math.cos(t * 0.17 + k * 1.7));
    const g = c.createRadialGradient(x, y, 0, x, y, 900);
    g.addColorStop(0, color + Math.round(a * 255).toString(16).padStart(2, "0"));
    g.addColorStop(1, color + "00");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
}

export function drawLyricsView(c: CanvasRenderingContext2D, m: Model, t: number, alpha: number) {
  const spotify = m.settings.template === "spotify";
  const k = LOOK[spotify ? "spotify" : "apple"];
  const { rows, tops } = layout(c, m);
  const starts = m.lyrics.map((l) => l.t0);
  const reached = (i: number) => (i < starts.length ? prog(t, starts[i], starts[i] + 0.35) : 0);
  let cur = -1;
  starts.forEach((s, i) => { if (t >= s) cur = i; });

  c.save();
  c.globalAlpha = alpha;
  background(c, m, t);
  const scroll = cur < 0 ? 0 : lerp(tops[Math.max(cur - 1, 0)], tops[cur], easeOut(prog(t, starts[cur], starts[cur] + 0.7)));
  c.font = fontOf(k); c.textBaseline = "top";
  rows.forEach((r, i) => {
    const y = k.anchor + tops[i] - scroll, h = r.length * k.lh;
    if (y + h < -80 || y > H + 80) return;
    const a = reached(i) * (1 - reached(i + 1)); // 1 while this line is the current one
    c.save();
    if (spotify) {
      c.fillStyle = reached(i) > 0 ? "#fff" : "rgba(0,0,0,.5)";
      c.globalAlpha = alpha * (i === cur ? 1 : lerp(1, 0.85, reached(i)));
    } else {
      const dist = Math.abs(i - Math.max(cur, 0)), sc = lerp(0.9, 1, a);
      c.fillStyle = "#fff";
      c.globalAlpha = alpha * lerp(0.3, 1, a);
      c.translate(k.x, y + h / 2); c.scale(sc, sc); c.translate(-k.x, -(y + h / 2));
      const blur = Math.round((1 - a) * Math.min(dist, 3) * 1.2 * c.getTransform().a); // filter px ignore the transform
      if (blur > 0 && "filter" in c) c.filter = `blur(${blur}px)`;
    }
    r.forEach((s, j) => c.fillText(s, k.x, y + j * k.lh));
    c.restore();
  });
  chrome(c, m, t, k);
  c.restore();
}

/** Fades, song header (cover, title, artist) and progress bar over the scrolling lyrics. */
function chrome(c: CanvasRenderingContext2D, m: Model, t: number, k: (typeof LOOK)["apple"]) {
  const s = m.settings, bg = s.template === "spotify" ? s.style.lyricsColor : "#0b0b0d";
  for (const [y0, y1, a, b] of [[0, 380, 1, 0], [H - 380, H, 0, 1]]) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, bg + (a ? "f2" : "00")); g.addColorStop(a ? 0.6 : 0.4, bg + "f2"); g.addColorStop(1, bg + (b ? "f2" : "00"));
    c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0);
  }
  c.textBaseline = "top";
  const img = covers.get(s.cover), size = 132;
  let tx = k.x;
  if (img?.complete && img.naturalWidth) {
    c.save(); c.beginPath(); c.roundRect(k.x, 100, size, size, 14); c.clip();
    c.drawImage(img, k.x, 100, size, size); c.restore();
    tx += size + 32;
  }
  c.fillStyle = "#fff"; c.font = `${k.weight} 44px ${k.family}`; c.fillText(s.songTitle, tx, 120);
  c.fillStyle = "rgba(255,255,255,.6)"; c.font = `500 34px ${k.family}`; c.fillText(s.songArtist, tx, 176);

  const x0 = k.x, w = W - 2 * k.x, y = H - 190, p = Math.min(1, t / s.duration);
  c.fillStyle = "rgba(255,255,255,.28)"; c.beginPath(); c.roundRect(x0, y, w, 8, 4); c.fill();
  c.fillStyle = "#fff"; c.beginPath(); c.roundRect(x0, y, Math.max(8, w * p), 8, 4); c.fill();
  c.fillStyle = "rgba(255,255,255,.6)"; c.font = `500 26px ${k.family}`;
  c.textAlign = "left"; c.fillText(formatTime(t), x0, y + 28);
  c.textAlign = "right"; c.fillText("-" + formatTime(s.duration - t), x0 + w, y + 28);
  c.textAlign = "left";
}
