/**
 * Streaming-app lyrics templates ("apple" = blurred glow + dim/blur lines, "spotify" = now-playing page with the lyric line under the cover, "cover" = full-bleed cover with flipping lines). Flat Canvas 2D, drawn straight onto the output (no 3D plane).
 */
import { H, W } from "./constants";
import { easeOut, lerp, prog } from "../shared/math";
import type { Model } from "./model";
import { LYRICS } from "../shared/theme";

const LOOK = {
  apple: { family: LYRICS.apple.font, weight: 700, size: 76, lh: 94, gap: 46, x: 80, anchor: 640 },
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
const APPLE_BG = LYRICS.apple.bg;
const MAX_W = W - 160;

interface Layout { rows: string[][]; tops: number[] }
const layouts = new WeakMap<Model, Layout>();

function layout(c: CanvasRenderingContext2D, m: Model): Layout {
  let l = layouts.get(m);
  if (l) return l;
  const k = LOOK.apple;
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
  c.fillStyle = APPLE_BG; c.fillRect(0, 0, W, H);
  [0.6, 0.4, 0.5].forEach((a, k) => {
    const x = W * (0.5 + 0.45 * Math.sin(t * 0.21 + k * 2.1)), y = H * (0.5 + 0.4 * Math.cos(t * 0.17 + k * 1.7));
    const g = c.createRadialGradient(x, y, 0, x, y, 900);
    g.addColorStop(0, color + Math.round(a * 255).toString(16).padStart(2, "0"));
    g.addColorStop(1, color + "00");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
}

export function drawLyricsView(c: CanvasRenderingContext2D, m: Model, t: number, alpha: number) {
  if (m.settings.template === "spotify") return spotifyView(c, m, t, alpha);
  if (m.settings.template === "cover") return coverView(c, m, t, alpha);
  const k = LOOK.apple;
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
    const dist = Math.abs(i - Math.max(cur, 0)), sc = lerp(0.9, 1, a);
    c.fillStyle = LYRICS.apple.dim;
    c.globalAlpha = alpha * lerp(0.7, 1, a);
    c.translate(k.x, y + h / 2); c.scale(sc, sc); c.translate(-k.x, -(y + h / 2));
    const blur = Math.round((1 - a) * Math.min(dist, 3) * 1.2 * c.getTransform().a); // filter px ignore the transform
    if (blur > 0 && "filter" in c) c.filter = `blur(${blur}px)`;
    r.forEach((s, j) => c.fillText(s, k.x, y + j * k.lh));
    if (i === cur) { // karaoke sweep: white fill follows the line's typing progress across its rows
      const widths = r.map((s) => c.measureText(s).width);
      let left = prog(t, m.lyrics[i].t0, m.lyrics[i].t1) * widths.reduce((x, w) => x + w, 0);
      c.fillStyle = LYRICS.apple.text;
      r.forEach((s, j) => {
        c.save(); c.beginPath(); c.rect(k.x, y + j * k.lh, Math.min(left, widths[j]), k.lh); c.clip();
        c.fillText(s, k.x, y + j * k.lh); c.restore();
        left = Math.max(0, left - widths[j]);
      });
    }
    c.restore();
  });
  chrome(c, m, k);
  c.restore();
}

/** Apple header's outline star and "..." at the right edge, centred on the title block. */
function icons(c: CanvasRenderingContext2D, x: number) {
  const cx = W - x - 130, cy = 148;
  c.strokeStyle = c.fillStyle = LYRICS.apple.text; c.lineWidth = 6; c.lineJoin = "round";
  c.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 15 : 36, a = -Math.PI / 2 + (i * Math.PI) / 5; c.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  c.closePath(); c.stroke();
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(W - x - 12 + i * 22, cy, 8, 0, 7); c.fill(); }
}

/** Fades, song header (cover, title, artist) and progress bar over the scrolling lyrics. */
function chrome(c: CanvasRenderingContext2D, m: Model, k: (typeof LOOK)["apple"]) {
  const s = m.settings, bg = APPLE_BG;
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
  c.fillStyle = LYRICS.apple.text; c.font = `${k.weight} 44px ${k.family}`; c.fillText(s.songTitle, tx, 120);
  c.fillStyle = LYRICS.apple.sub; c.font = `500 34px ${k.family}`; c.fillText(s.songArtist, tx, 176);

  icons(c, k.x);
}

/** Player-style m:ss, whole seconds. */
const clock = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, "0")}`;

/** Greedy word wrap with the context's current font. */
function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const rows: string[] = [];
  let row = "";
  for (const w of text.split(/\s+/)) {
    if (row && c.measureText(`${row} ${w}`).width > maxW) { rows.push(row); row = w; } else row = row ? `${row} ${w}` : w;
  }
  return [...rows, row];
}

/** Spotify now-playing page: dimmed colour background, cover, current lyric line, title, progress, controls, lyrics card. */
function spotifyView(c: CanvasRenderingContext2D, m: Model, t: number, alpha: number) {
  const s = m.settings, col = s.style.lyricsColor, X = 60, S = W - 2 * X, F = LYRICS.spotify.font, K = LYRICS.spotify;
  c.save(); c.globalAlpha = alpha; c.textBaseline = "top";
  c.fillStyle = col; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, K.shadeTop); g.addColorStop(1, K.shadeBottom);
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  c.fillStyle = c.strokeStyle = K.text; c.lineWidth = 5; c.lineJoin = c.lineCap = "round";
  c.beginPath(); c.moveTo(X, 100); c.lineTo(X + 22, 122); c.lineTo(X + 44, 100); c.stroke();
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(W - X - 10 + i * 20, 111, 5, 0, 7); c.fill(); }
  c.textAlign = "center"; c.font = `700 32px ${F}`; c.fillText(s.songTitle, W / 2, 94); c.textAlign = "left";

  const img = covers.get(s.cover);
  c.save(); c.beginPath(); c.roundRect(X, 200, S, S, 12); c.clip();
  if (img?.complete && img.naturalWidth) c.drawImage(img, X, 200, S, S); else { c.fillStyle = K.placeholder; c.fillRect(X, 200, S, S); }
  c.restore();

  let cur = -1;
  m.lyrics.forEach((l, i) => { if (t >= l.t0) cur = i; });
  c.font = `700 54px ${F}`; c.fillStyle = K.text;
  const rows = wrap(c, cur < 0 ? "" : m.lyrics[cur].raw, S);
  rows.slice(0, 2).forEach((r, j) => c.fillText(r, X, 1195 + j * 66));

  c.font = `700 58px ${F}`; c.fillText(s.songTitle, X, 1350);
  c.fillStyle = K.sub; c.font = `500 40px ${F}`; c.fillText(s.songArtist, X, 1422);
  c.strokeStyle = K.text; c.lineWidth = 5;
  c.beginPath(); c.arc(W - X - 40, 1385, 38, 0, 7); c.moveTo(W - X - 62, 1385); c.lineTo(W - X - 18, 1385); c.moveTo(W - X - 40, 1363); c.lineTo(W - X - 40, 1407); c.stroke();

  const p = Math.min(1, t / s.duration), px = X + S * p;
  c.fillStyle = K.track; c.beginPath(); c.roundRect(X, 1516, S, 8, 4); c.fill();
  c.fillStyle = K.text; c.beginPath(); c.roundRect(X, 1516, S * p, 8, 4); c.fill();
  c.beginPath(); c.arc(px, 1520, 15, 0, 7); c.fill();
  c.fillStyle = K.sub; c.font = `500 28px ${F}`;
  c.fillText(clock(t), X, 1546);
  c.textAlign = "right"; c.fillText("-" + clock(Math.ceil(s.duration - t)), X + S, 1546); c.textAlign = "left";

  const cy = 1670;
  c.fillStyle = K.text; c.beginPath(); c.arc(W / 2, cy, 78, 0, 7); c.fill();
  c.fillStyle = K.playIcon; c.fillRect(W / 2 - 24, cy - 30, 16, 60); c.fillRect(W / 2 + 8, cy - 30, 16, 60);
  c.fillStyle = K.text;
  for (const d of [-1, 1]) { // prev / next: triangle + bar
    const x = W / 2 + d * 260;
    c.beginPath(); c.moveTo(x - d * 22, cy); c.lineTo(x + d * 22, cy - 30); c.lineTo(x + d * 22, cy + 30); c.fill();
    c.fillRect(x - d * 22 - 6, cy - 30, 12, 60);
  }

  c.fillStyle = col; c.beginPath(); c.roundRect(30, 1800, W - 60, 220, 28); c.fill();
  c.fillStyle = K.text; c.font = `700 38px ${F}`; c.fillText("Lyrics", 70, 1840);
  c.restore();
}

/** Full-bleed cover with a fade at the bottom, the current line (flips over on each change) and a player card. */
function coverView(c: CanvasRenderingContext2D, m: Model, t: number, alpha: number) {
  const s = m.settings, F = LYRICS.spotify.font, K = LYRICS.cover, img = covers.get(s.cover);
  c.save(); c.globalAlpha = alpha; c.textBaseline = "top";
  c.fillStyle = s.style.lyricsColor; c.fillRect(0, 0, W, H);
  if (img?.complete && img.naturalWidth) { // cover-fit: scale to the taller side, crop the middle
    const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    c.drawImage(img, (W - img.naturalWidth * k) / 2, (H - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
  }
  const g = c.createLinearGradient(0, 950, 0, 1700);
  g.addColorStop(0, K.fadeTop); g.addColorStop(1, K.fadeBottom);
  c.fillStyle = g; c.fillRect(0, 950, W, H - 950);

  let cur = -1;
  m.lyrics.forEach((l, i) => { if (t >= l.t0) cur = i; });
  const u = cur < 0 ? 1 : prog(t, m.lyrics[cur].t0, m.lyrics[cur].t0 + 0.5);
  // flip: the old line folds away over the first half, the new one unfolds over the second
  const [i, fy] = u < 0.5 && cur > 0 ? [cur - 1, 1 - 2 * u] : [cur, u < 0.5 ? 0 : 2 * u - 1];
  if (i >= 0) {
    c.font = `700 52px ${F}`; c.textAlign = "center"; c.fillStyle = K.text;
    const rows = wrap(c, m.lyrics[i].raw, W - 200), cy = 1330;
    c.save(); c.translate(W / 2, cy); c.scale(1, Math.max(fy, 0.001)); c.translate(-W / 2, -cy);
    rows.forEach((r, j) => c.fillText(r, W / 2, cy - rows.length * 33 + j * 66));
    c.restore();
  }

  c.fillStyle = K.card; c.strokeStyle = K.cardBorder; c.lineWidth = 3;
  c.beginPath(); c.roundRect(40, 1560, W - 80, 420, 64); c.fill(); c.stroke();
  c.fillStyle = LYRICS.spotify.text; c.font = `700 60px ${F}`; c.fillText(s.songTitle, W / 2, 1620);
  c.fillStyle = K.sub; c.font = `500 52px ${F}`; c.fillText(s.songArtist, W / 2, 1700);
  const p = Math.min(1, t / s.duration);
  c.fillStyle = K.track; c.beginPath(); c.roundRect(200, 1822, W - 400, 22, 11); c.fill();
  c.fillStyle = K.progress; c.beginPath(); c.roundRect(200, 1822, Math.max(22, (W - 400) * p), 22, 11); c.fill();
  c.font = `500 34px ${F}`; c.fillStyle = K.sub;
  c.textAlign = "left"; c.fillText(clock(t), 90, 1820);
  c.textAlign = "right"; c.fillText("-" + clock(Math.ceil(s.duration - t)), W - 90, 1820);
  c.restore();
}
