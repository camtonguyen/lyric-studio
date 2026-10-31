import { useEffect, useRef, useState } from "react";
import { formatTime, round2, type Model } from "../engine";
import { usePlayerValue } from "../hooks/usePlayer";
import type { ProjectActions } from "../hooks/useProject";
import type { Player } from "../player/Player";
import { hasGitLog } from "../project/template";
import type { Project } from "../project/types";

interface Props { project: Project; model: Model; actions: ProjectActions; player: Player; selected: number; onSelect(i: number): void }

type Kind = "line" | "comment" | "git" | "ending";
interface Block { kind: Kind; index: number; x0: number; x1: number; y: number; h: number }
interface Drag { block: Block; edge: boolean; t0: number; start: number; end: number; hadEnd: boolean }

const HEIGHT = 132, PAD = 10;
const COLORS: Record<Kind, [string, string]> = { line: ["#4a1c1a", "#c2413a"], comment: ["#3b3324", "#a1874f"], git: ["#3a2a55", "#7d5cc0"], ending: ["#5aa0ff", "#5aa0ff"] };
const r2 = (v: number) => round2(Math.max(0, v));

/** Song waveform + draggable blocks for each line, the git log and the ending. */
export function Timeline({ project, model, actions, player, selected, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const blocks = useRef<Block[]>([]);
  const drag = useRef<Drag | null>(null);
  const [pps, setPps] = useState(40); // pixels per second
  const [width, setWidth] = useState(800);
  const song = usePlayerValue(player, (p) => p.song);
  const time = usePlayerValue(player, (p) => p.time());
  const playing = usePlayerValue(player, (p) => p.playing);
  const s = project.settings;
  const X = (t: number) => PAD + t * pps;

  useEffect(() => {
    const el = scrollRef.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // keep the playhead in view while playing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    const x = X(time);
    if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft) el.scrollLeft = x - 80;
  });

  // draw
  useEffect(() => {
    const cv = canvasRef.current!, dpr = window.devicePixelRatio || 1;
    const w = Math.max(width, Math.ceil(s.duration * pps) + 40);
    cv.width = w * dpr; cv.height = HEIGHT * dpr; cv.style.width = `${w}px`; cv.style.height = `${HEIGHT}px`;
    const c = cv.getContext("2d")!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, HEIGHT);
    c.fillStyle = "#0d0e11"; c.fillRect(X(0), 18, s.duration * pps, HEIGHT - 18);

    const peaks = song?.peaks;
    if (peaks) {
      c.fillStyle = "#262a33";
      const step = Math.max(1, Math.floor(100 / pps));
      const o = Math.round(s.audioStart * 100);
      for (let i = o; i < peaks.length && (i - o) / 100 <= s.duration; i += step) {
        const v = peaks[i] * 46;
        c.fillRect(X((i - o) / 100), 75 - v, Math.max(1, (step * pps) / 100), v * 2);
      }
    }
    c.font = "11px system-ui"; c.fillStyle = "#6b7079"; c.textBaseline = "top";
    const every = pps > 60 ? 1 : pps > 25 ? 2 : pps > 12 ? 5 : 10;
    for (let t = 0; t <= s.duration; t += every) { c.fillRect(X(t), 12, 1, 6); c.fillText(formatTime(t).replace(/\.00$/, ""), X(t) + 3, 1); }

    const list: Block[] = [];
    if (hasGitLog(s)) list.push({ kind: "git", index: 0, x0: X(s.gitLog.at), x1: X(s.gitLog.at + s.gitLog.duration), y: 104, h: 22 });
    const cm = model.lines[0];
    list.push({ kind: "comment", index: 0, x0: X(cm.t0), x1: X(cm.t1), y: 26, h: 30 });
    model.lyrics.forEach((l, i) => list.push({ kind: "line", index: i, x0: X(l.t0), x1: X(l.t1), y: i % 2 ? 66 : 26, h: 30 }));

    for (const b of list) {
      const isCollab = b.kind === "line" && model.lyrics[b.index].who !== s.author;
      const sel = b.kind === "line" && b.index === selected;
      const [fill, stroke] = COLORS[b.kind];
      c.beginPath(); c.roundRect(b.x0, b.y, Math.max(4, b.x1 - b.x0), b.h, 5);
      c.fillStyle = isCollab ? "#4a3d12" : fill; c.fill();
      c.strokeStyle = sel ? "#ffc53a" : stroke; c.lineWidth = sel ? 2 : 1; c.stroke();
      c.save(); c.beginPath(); c.rect(b.x0, b.y, Math.max(4, b.x1 - b.x0), b.h); c.clip();
      c.fillStyle = "#e8e2dc"; c.textBaseline = "middle";
      c.fillText(b.kind === "git" ? "git log" : b.kind === "comment" ? "// comment" : `${b.index + 1} ${model.lyrics[b.index].raw}`, b.x0 + 5, b.y + b.h / 2 + 1);
      c.restore();
      c.fillStyle = "#ffffff55"; c.fillRect(b.x1 - 3, b.y + 6, 2, b.h - 12);
    }
    if (s.ending.enabled) {
      const x = X(s.ending.at);
      c.fillStyle = COLORS.ending[0]; c.fillRect(x - 1, 18, 2, HEIGHT - 18);
      c.textBaseline = "top"; c.fillText("ending", x + 4, 106);
      list.push({ kind: "ending", index: 0, x0: x - 5, x1: x + 5, y: 18, h: HEIGHT - 18 });
    }
    blocks.current = list;
  }, [model, pps, width, selected, song, s.audioStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- interaction
  const pointer = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = [...blocks.current].reverse().find((b) => b.kind !== "comment" && x >= b.x0 - 2 && x <= b.x1 + 2 && y >= b.y && y <= b.y + b.h);
    return { x, t: (x - PAD) / pps, hit, edge: !!hit && hit.kind !== "ending" && x > hit.x1 - 7 };
  };

  const onDown = (e: React.PointerEvent) => {
    const { t, hit, edge } = pointer(e);
    if (!hit) { player.pause(); player.seek(t); return; }
    canvasRef.current!.setPointerCapture(e.pointerId);
    if (hit.kind === "line") {
      onSelect(hit.index);
      const l = model.lyrics[hit.index], tm = project.lines[hit.index];
      drag.current = { block: hit, edge, t0: t, start: l.t0, end: l.t1, hadEnd: tm?.end != null };
    } else if (hit.kind === "git") drag.current = { block: hit, edge, t0: t, start: s.gitLog.at, end: s.gitLog.duration, hadEnd: true };
    else drag.current = { block: hit, edge: false, t0: t, start: s.ending.at, end: 0, hadEnd: false };
  };

  const onMove = (e: React.PointerEvent) => {
    const p = pointer(e), d = drag.current;
    if (!d) { canvasRef.current!.style.cursor = p.hit ? (p.edge || p.hit.kind === "ending" ? "ew-resize" : "grab") : "pointer"; return; }
    const dt = p.t - d.t0;
    if (d.block.kind === "line") {
      if (d.edge) actions.setTiming(d.block.index, { start: r2(d.start), end: r2(Math.max(d.start + 0.2, d.end + dt)) });
      else actions.setTiming(d.block.index, { start: r2(d.start + dt), end: d.hadEnd ? r2(d.end + dt) : null });
    } else if (d.block.kind === "git") {
      if (d.edge) actions.setGitLog({ duration: r2(Math.max(1, d.end + dt)) });
      else actions.setGitLog({ at: r2(d.start + dt) });
    } else actions.setEnding({ at: r2(d.start + dt) });
  };

  return (
    <section className="timeline">
      <div className="timeline-head">
        <span>Timeline: drag blocks to move them, drag a block's right edge to change its end, click to seek</span>
        <span className="spacer" />
        Zoom <input type="range" min={8} max={160} value={pps} onChange={(e) => setPps(+e.target.value)} />
      </div>
      <div className="timeline-scroll" ref={scrollRef}>
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} />
        <div className="playhead" style={{ left: X(time) }} />
      </div>
    </section>
  );
}
