/** Virtual camera: follows the cursor, cuts between shots, pulls back for the ending. */
import { GUTTER, H, LINE_H, TOP, W } from "./constants";
import { metrics } from "./fonts";
import { DEG, ease, lerp, mul, perspective, prog, rotX, rotY, rotZ, scale, toGL, translate } from "./math";
import { activeLineIndex, typedCount, type Model } from "./model";
import { hasGitLog } from "../project/template";

export interface Camera {
  zoom: number; rx: number; ry: number; rz: number;
  dof: number;
  tx: number; ty: number; // surface point in focus
  px: number; py: number; // where that point sits on screen
}

const WHIP = 0.42; // seconds for a camera cut

function shotAt(m: Model, t: number) {
  const shots = m.shots;
  let i = 0;
  while (i + 1 < shots.length && t >= shots[i + 1].t) i++;
  const s = shots[i].p, p = (shots[i - 1] ?? shots[i]).p;
  const k = ease(prog(t, shots[i].t, shots[i].t + WHIP));
  const drift = Math.min(t - shots[i].t, 8);
  const cam = m.settings.style.camera;
  const dir = i % 2 ? 1 : -1;
  return {
    zoom: lerp(p[0], s[0], k) * (1 + 0.025 * drift),
    rx: lerp(p[1], s[1], k),
    ry: lerp(p[2], s[2], k) - 0.5 * drift * dir * cam,
    rz: lerp(p[3], s[3], k) + 0.35 * drift * dir * cam,
    dx: lerp(p[4], s[4], k),
    dy: lerp(p[5], s[5], k),
    dof: lerp(p[6], s[6], k),
  };
}

export function cursorPoint(m: Model, t: number) {
  const li = activeLineIndex(m, t);
  return { x: GUTTER + typedCount(m.lines[li], t) * metrics.charWidth, y: TOP + li * LINE_H + LINE_H / 2, li };
}

export function gitLogPoint(m: Model) {
  return { x: GUTTER, y: TOP + (m.gitLineIndex + 1) * LINE_H + 30 };
}

export function camera(m: Model, t: number): Camera {
  const s = m.settings;
  const c = shotAt(m, t);

  // focus: cursor position averaged over the last ~0.45s (smooth follow)
  let tx = 0, ty = 0;
  for (let k = 0; k < 10; k++) {
    const p = cursorPoint(m, Math.max(0, t - k * 0.045));
    tx += p.x / 10;
    ty += p.y / 10;
  }
  if (hasGitLog(s)) {
    const g = s.gitLog, gp = gitLogPoint(m);
    const k = ease(prog(t, g.at, g.at + 0.6)) * (1 - ease(prog(t, g.at + g.duration - 0.4, g.at + g.duration + 0.2)));
    tx = lerp(tx, gp.x + 380, k);
    ty = lerp(ty, gp.y + 200, k);
  }

  let px = W / 2 + c.dx, py = H / 2 + c.dy;
  let { zoom, rx, ry, rz, dof } = c;
  const O = s.ending.enabled ? s.ending.at : Infinity;
  if (t > O) {
    // flatten, centre and ease out to the whole editor, then it fades (see renderer)
    const a = ease(prog(t, O, O + 1.4));
    tx = lerp(tx, m.editorW / 2, a);
    ty = lerp(ty, m.editorH / 2, a);
    px = lerp(px, W / 2, a);
    py = lerp(py, H / 2, a);
    zoom = lerp(zoom, (W * 0.92) / m.editorW, a) * (1 - 0.03 * prog(t, O + 1.4, O + 4));
    rx = lerp(rx, 0, a); ry = lerp(ry, 0, a); rz = lerp(rz, 0, a); dof = lerp(dof, 0, a);
  }
  return { zoom, rx, ry, rz, dof, tx, ty, px, py };
}

/** How fast the camera moves (drives motion blur). */
export function cameraSpeed(a: Camera, b: Camera) {
  return (
    Math.abs(a.zoom - b.zoom) * 700 +
    (Math.abs(a.rx - b.rx) + Math.abs(a.ry - b.ry) + Math.abs(a.rz - b.rz)) * 9 +
    Math.hypot(a.tx - b.tx, a.ty - b.ty) * a.zoom * 0.25
  );
}

const CLIP = [2 / W, 0, 0, -1, 0, -2 / H, 0, 1, 0, 0, -1e-4, 0, 0, 0, 0, 1];

/** Surface → clip-space matrix (same maths as a CSS 3D transform). */
export function cameraMatrix(c: Camera) {
  let m = mul(CLIP, translate(c.px, c.py));
  m = mul(m, perspective(2000));
  m = mul(m, rotX(c.rx * DEG));
  m = mul(m, rotY(c.ry * DEG));
  m = mul(m, rotZ(c.rz * DEG));
  m = mul(m, scale(c.zoom));
  m = mul(m, translate(-c.tx, -c.ty));
  return toGL(m);
}
