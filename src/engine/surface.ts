/**
 * The flat editor surface (tab bar, code, cursors, toast, git log), drawn with
 * Canvas 2D one row ("band") at a time. Only rows whose content changed are
 * redrawn and uploaded to the GPU, which keeps long songs fast.
 */
import { FONT, FONT_SIZE, GUTTER, LINE_H, TOP } from "./constants";
import { metrics } from "./fonts";
import { easeOut, lerp, prog } from "../shared/math";
import { CODE } from "../shared/theme";
import { typedCount, type Model } from "./model";
import { cursorPoint, gitLogPoint } from "./camera";
import type { Plane } from "./plane";

const { bg: BG, bgActive: BG_ACTIVE } = CODE;

/** Something drawn on top of the code, spanning surface rows y0..y1. */
interface Deco { y0: number; y1: number; key: string; draw(c: CanvasRenderingContext2D): void }
interface FrameState { decos: Deco[]; activeRow: number; tabMessageAlpha: number }

const q = (v: number, steps = 20) => Math.round(v * steps) / steps;

export class Surface {
  private strip = document.createElement("canvas");
  private tabStrip = document.createElement("canvas");
  private sigs = new Map<number, string>();

  constructor(private plane: Plane) {}

  /** Call after the texture is (re)allocated. */
  resize(width: number) {
    const s = this.plane.texScale;
    this.strip.width = this.tabStrip.width = Math.round(width * s);
    this.strip.height = Math.round(LINE_H * s);
    this.tabStrip.height = Math.round(TOP * s);
    this.invalidate();
  }

  invalidate() { this.sigs.clear(); }

  update(m: Model, t: number) {
    const st = this.frameState(m, t);
    const tabSig = `${st.tabMessageAlpha}`;
    if (this.sigs.get(-1) !== tabSig) { this.sigs.set(-1, tabSig); this.drawTab(m, st); }
    for (let row = 0; row < m.rows; row++) {
      const y0 = TOP + row * LINE_H;
      let sig = (row < m.lines.length ? typedCount(m.lines[row], t) : "") + (st.activeRow === row ? "h" : "");
      for (const d of st.decos) if (d.y0 < y0 + LINE_H && d.y1 > y0) sig += "|" + d.key;
      if (this.sigs.get(row) !== sig) { this.sigs.set(row, sig); this.drawRow(m, row, st, t); }
    }
  }

  // ------------------------------------------------------------ state
  private frameState(m: Model, t: number): FrameState {
    const s = m.settings, st = s.style, cw = metrics.charWidth;
    const decos: Deco[] = [];
    const cp = cursorPoint(m, t);
    // the collaborator who typed last (or will type first)
    const collab = m.collabs.filter((l) => l.t0 <= t).pop() ?? m.collabs[0];
    const collabIndex = collab ? m.lines.indexOf(collab) : -1;
    const collabTyping = !!collab && t >= collab.t0 && t <= collab.t1 + 0.3;

    // main cursor
    const row = collabTyping ? collabIndex - 1 : cp.li;
    const line = m.lines[row];
    const n = typedCount(line, t);
    const busy = typedCount(line, t + 0.25) !== typedCount(line, t - 0.25);
    const ended = s.ending.enabled && t > s.ending.at + 1.5;
    const mx = GUTTER + n * cw + 2, my = TOP + row * LINE_H + 15;
    if (busy || ended || Math.floor(t * 1.9) % 2 === 0) decos.push(cursor(mx, my, st.cursorColor, `c${row},${n}`));
    if (t > m.joinAt) decos.push(tag(s.author, mx + 10, my - 40, st.cursorColor, CODE.cursorTagText, `ct${row},${n}`));

    // collaborator cursor
    if (collab && t > m.joinAt + 0.6) {
      const r = t < collab.t0 ? Math.max(0, cp.li - 2) : collabIndex;
      const cn = t < collab.t0 ? m.lines[r].text.length : typedCount(collab, t);
      const cx = GUTTER + cn * cw + 2, cy = TOP + r * LINE_H + 15;
      decos.push(cursor(cx, cy, st.collaboratorColor, `y${r},${cn}`));
      decos.push(tag(collab.who, cx + 10, cy + 72, st.collaboratorColor, CODE.collabTagText, `yt${r},${cn},${collab.who}`));
    }

    // "x joined the session" toast
    const ta = q(prog(t, m.joinAt, m.joinAt + 0.3) * (1 - prog(t, m.joinAt + 3.2, m.joinAt + 3.6)));
    if (ta > 0) {
      const y = TOP + (cp.li + 2) * LINE_H + 30 + Math.round((1 - easeOut(prog(t, m.joinAt, m.joinAt + 0.4))) * 20);
      decos.push({ y0: y - 4, y1: y + 70, key: `to${ta},${y}`, draw: (c) => toast(c, `${m.collabs[0].who} joined the session`, y, ta, st.collaboratorColor) });
    }

    // git log
    const g = s.gitLog;
    if (g.enabled) {
      const on = q(prog(t, g.at + 0.2, g.at + 0.6) * (1 - prog(t, g.at + g.duration - 0.4, g.at + g.duration)));
      if (on > 0) {
        const gp = gitLogPoint(m), count = m.gitEntries.length;
        const ea = m.gitEntries.map((_, i) => q(easeOut(prog(t, g.at + 0.5 + i * 0.55, g.at + 0.8 + i * 0.55))));
        const ca = q(prog(t, g.at + 0.4 + count * 0.55, g.at + 0.7 + count * 0.55));
        const year = Math.round(lerp(g.counterFrom, g.counterTo, easeOut(prog(t, g.at + 0.6 + count * 0.55, g.at + g.duration - 0.8))));
        decos.push({
          y0: gp.y - 10, y1: gp.y + 70 + count * 64 + 150, key: `gl${on},${ea},${ca},${year}`,
          draw: (c) => gitLog(c, m, gp, on, ea, ca, year),
        });
      }
    }
    return { decos, activeRow: row, tabMessageAlpha: q(prog(t, s.tabMessageAt, s.tabMessageAt + 0.3), 10) };
  }

  // ------------------------------------------------------------ drawing
  private drawTab(m: Model, st: FrameState) {
    const c = this.tabStrip.getContext("2d")!, s = m.settings, k = this.plane.texScale;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.fillStyle = BG; c.fillRect(0, 0, m.editorW, TOP);
    c.fillStyle = CODE.tabBar; c.fillRect(0, 0, m.editorW, 110);
    c.fillStyle = CODE.tabBorder; c.fillRect(0, 108, m.editorW, 2);
    c.font = `500 36px ${FONT}`;
    const fw = c.measureText(s.fileName).width, tw = fw + 126;
    c.fillStyle = BG; c.fillRect(30, 0, tw, 110);
    c.fillStyle = s.style.cursorColor; c.fillRect(30, 0, tw, 5);
    c.fillStyle = CODE.tabName; c.textBaseline = "middle"; c.fillText(s.fileName, 74, 57);
    c.fillStyle = CODE.tabDot; c.beginPath(); c.arc(74 + fw + 30, 57, 8, 0, Math.PI * 2); c.fill();
    if (st.tabMessageAlpha > 0) {
      c.globalAlpha = st.tabMessageAlpha; c.font = `500 30px ${FONT}`; c.fillStyle = CODE.tabMessage;
      c.fillText(s.tabMessage, 30 + tw + 50, 57); c.globalAlpha = 1;
    }
    this.plane.upload(0, this.tabStrip);
  }

  private drawRow(m: Model, row: number, st: FrameState, t: number) {
    const c = this.strip.getContext("2d")!, k = this.plane.texScale, y0 = TOP + row * LINE_H, mid = y0 + LINE_H / 2;
    c.setTransform(k, 0, 0, k, 0, -y0 * k);
    c.fillStyle = st.activeRow === row ? BG_ACTIVE : BG;
    c.fillRect(0, y0, m.editorW, LINE_H);
    if (row < m.lines.length) {
      const line = m.lines[row], n = typedCount(line, t);
      c.textBaseline = "middle";
      c.font = `500 30px ${FONT}`; c.fillStyle = CODE.lineNumber; c.globalAlpha = n > 0 || row === 0 ? 1 : 0.35;
      c.textAlign = "right"; c.fillText(String(row + 1), 100, mid + 2); c.textAlign = "left"; c.globalAlpha = 1;
      c.font = `800 ${FONT_SIZE}px ${FONT}`;
      let left = n, x = GUTTER;
      for (const [text, color] of line.tokens) {
        if (left <= 0) break;
        const part = text.slice(0, left);
        left -= part.length;
        if (color) { c.fillStyle = color; c.fillText(part, x, mid + 3); }
        x += part.length * metrics.charWidth;
      }
      // who typed it, once the line is complete
      if (row > 0 && n >= line.text.length) {
        c.font = `500 26px ${FONT}`; c.globalAlpha = 0.75;
        c.fillStyle = line.who === m.settings.author ? m.settings.style.cursorColor : m.settings.style.collaboratorColor;
        c.fillText(`// ${line.who}`, x + 36, mid + 3); c.globalAlpha = 1;
      }
    }
    for (const d of st.decos) if (d.y0 < y0 + LINE_H && d.y1 > y0) { c.save(); d.draw(c); c.restore(); }
    this.plane.upload(y0, this.strip);
  }
}

// ------------------------------------------------------------ decoration painters
function cursor(x: number, y: number, color: string, key: string): Deco {
  return { y0: y - 6, y1: y + 72, key, draw: (c) => { c.shadowColor = color; c.shadowBlur = 14; c.fillStyle = color; c.fillRect(x, y, 30, 66); } };
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
}

function tag(text: string, x: number, y: number, bg: string, fg: string, key: string): Deco {
  return {
    y0: y - 2, y1: y + 36, key,
    draw: (c) => {
      c.font = `500 24px ${FONT}`;
      roundRect(c, x, y, c.measureText(text).width + 22, 34, 6);
      c.fillStyle = bg; c.fill();
      c.fillStyle = fg; c.textBaseline = "middle"; c.fillText(text, x + 11, y + 18);
    },
  };
}

function toast(c: CanvasRenderingContext2D, text: string, y: number, alpha: number, dot: string) {
  c.globalAlpha = alpha;
  c.font = `500 30px ${FONT}`;
  roundRect(c, GUTTER, y, c.measureText(text).width + 84, 64, 12);
  c.fillStyle = CODE.gitBox; c.fill();
  c.strokeStyle = CODE.gitBoxBorder; c.lineWidth = 2; c.stroke();
  c.fillStyle = dot; c.beginPath(); c.arc(GUTTER + 34, y + 32, 8, 0, Math.PI * 2); c.fill();
  c.fillStyle = CODE.gitText; c.textBaseline = "middle"; c.fillText(text, GUTTER + 58, y + 33);
}

function gitLog(c: CanvasRenderingContext2D, m: Model, p: { x: number; y: number }, on: number, entryAlpha: number[], counterAlpha: number, year: number) {
  const g = m.settings.gitLog;
  c.textBaseline = "alphabetic";
  c.globalAlpha = on;
  c.font = `500 28px ${FONT}`; c.fillStyle = CODE.gitCommand; c.fillText(g.command, p.x, p.y + 28);
  m.gitEntries.forEach((e, i) => {
    c.globalAlpha = on * entryAlpha[i];
    const y = p.y + 100 + i * 64;
    let x = p.x - (1 - entryAlpha[i]) * 30;
    const base = e.hot ? CODE.hot : CODE.cold;
    c.font = `500 36px ${FONT}`; c.fillStyle = base; c.fillText("•", x, y); x += 44;
    c.font = `800 36px ${FONT}`; c.fillStyle = e.hot ? base : CODE.year; c.fillText(e.year, x, y); x += c.measureText(e.year).width + 22;
    c.font = `500 36px ${FONT}`; c.fillStyle = base; c.fillText(e.text, x, y); x += c.measureText(e.text).width + 18;
    if (e.note) { c.font = `500 30px ${FONT}`; c.fillStyle = CODE.muted; c.fillText(e.note, x, y); }
  });
  c.globalAlpha = on * counterAlpha;
  const y = p.y + 190 + m.gitEntries.length * 64;
  c.font = `800 92px ${FONT}`; c.fillStyle = CODE.counter; c.fillText(String(year), p.x, y);
  const w = c.measureText(String(year)).width;
  c.font = `500 30px ${FONT}`; c.fillStyle = CODE.muted; c.fillText(g.counterLabel, p.x + w + 44, y);
}

