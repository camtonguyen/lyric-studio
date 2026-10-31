/**
 * Model = everything the renderer needs, derived from a Project:
 * code lines, per-character typing times, camera shots, collaborator, git log.
 * Pure functions, no DOM.
 */
import { EDITOR_W, EXTRA_ROWS, GUTTER, LINE_H, TOP } from "./constants";
import { metrics } from "./fonts";
import { commentLine, lyricToCode, type Token } from "../shared/lyrics";
import { hashStr, rng } from "../shared/math";
import { isLastInVerse, verseIndexes } from "../project/lines";
import { hasGitLog } from "../shared/template";
import { commentEnd, resolveTimes } from "../project/timing";
import type { Project, Settings } from "../project/types";

export interface CodeLine {
  raw: string;
  text: string;
  tokens: Token[];
  verse: number; // -1 for the comment line
  who: string; // name of whoever types this line
  lyric: number; // 1-based lyric index, 0 for the comment line
  t0: number; // typing starts
  t1: number; // typing ends
  charTimes: Float32Array; // time each character appears
}

/** zoom, rotX, rotY, rotZ, dx, dy, depth-of-field */
export type ShotParams = [number, number, number, number, number, number, number];
export interface Shot { t: number; p: ShotParams }

export interface GitEntry { year: string; text: string; note: string; hot: boolean }

export interface Model {
  settings: Settings;
  lines: CodeLine[]; // [comment, ...lyrics]
  lyrics: CodeLine[];
  rows: number;
  editorW: number;
  editorH: number;
  shots: Shot[];
  collabs: CodeLine[]; // lines typed by someone other than the main cursor
  joinAt: number;
  gitLineIndex: number;
  gitEntries: GitEntry[];
}

// ---------------------------------------------------------------- parsing
export const collaboratorNames = (s: Settings) => s.collaborators.split(",").map((n) => n.trim()).filter(Boolean);

/** Default typist: the main cursor, with a collaborator taking every 3rd line in turn. */
// ponytail: fixed pattern; users edit names per line in the table
export function autoWho(i: number, s: Settings) {
  const names = collaboratorNames(s);
  return names.length && i % 3 === 2 ? names[Math.floor(i / 3) % names.length] : s.author;
}

function parseLines(p: Project) {
  const c = commentLine(p.settings.comment);
  const comment: CodeLine = { raw: "", ...c, who: p.settings.author, verse: -1, lyric: 0, t0: 0, t1: 0, charTimes: new Float32Array() };
  const verses = verseIndexes(p.lines);
  const lyrics: CodeLine[] = p.lines.map((l, i) => ({
    raw: l.text,
    ...lyricToCode(l.text, isLastInVerse(p.lines, i)),
    who: l.who || autoWho(i, p.settings),
    verse: verses[i],
    lyric: i + 1,
    t0: 0, t1: 0, charTimes: new Float32Array(),
  }));
  return { comment, lyrics };
}

/** Per-character appear times: each line types out between its t0 and t1 with a little jitter. */
function schedule(line: CodeLine, index: number) {
  const r = rng(hashStr(line.text) + index * 31);
  const len = line.text.length;
  const w = new Float32Array(len);
  let total = 0;
  for (let i = 0; i < len; i++) {
    const ch = line.text[i];
    total += ch === " " && i < 3 ? 0.05 : (0.6 + r() * 0.8) * (ch === "." || ch === "(" ? 1.6 : 1);
    w[i] = total;
  }
  line.charTimes = new Float32Array(len);
  for (let i = 0; i < len; i++) line.charTimes[i] = line.t0 + (w[i] / total) * (line.t1 - line.t0);
}

// ---------------------------------------------------------------- camera shots
const SHOT_PRESETS: ShotParams[] = [
  [1.7, 9, 16, -3, 210, 0, 1.0],
  [0.95, 20, -16, 4, 60, 120, 1.0],
  [2.5, -6, 19, 5, 240, -20, 1.2],
  [1.25, 24, 11, -5, 120, 60, 1.0],
  [1.9, 10, -18, 3, 220, 20, 1.1],
  [2.3, 6, 18, -4, 230, 0, 1.2],
  [1.4, 17, -14, 3, 140, 40, 1.0],
];
const INTRO_SHOT: ShotParams = [3.0, 26, -22, -9, 120, 40, 1.2];
const WIDE_SHOT: ShotParams = [0.82, 26, -9, 2, 0, -60, 0.9];

function buildShots(s: Settings, lyrics: CodeLine[]): Shot[] {
  const st = s.style;
  const sc = (p: ShotParams): ShotParams => [p[0] * st.zoom, p[1] * st.camera, p[2] * st.camera, p[3] * st.camera, p[4], p[5], p[6]];
  const shots: Shot[] = [{ t: 0, p: sc(INTRO_SHOT) }, { t: s.commentAt + 0.25, p: sc(SHOT_PRESETS[0]) }];
  const glEnd = hasGitLog(s) ? s.gitLog.at + s.gitLog.duration : -1;
  let k = 1;
  let since = 0;
  lyrics.forEach((l, i) => {
    since++;
    const firstAfterGit = hasGitLog(s) && l.t0 >= glEnd && (i === 0 || lyrics[i - 1].t0 < glEnd);
    if (since >= st.cutEvery || firstAfterGit) {
      since = 0;
      shots.push({ t: Math.max(0.3, l.t0 - 0.1), p: sc(SHOT_PRESETS[k++ % SHOT_PRESETS.length]) });
    }
  });
  if (hasGitLog(s)) shots.push({ t: s.gitLog.at, p: sc(WIDE_SHOT) });
  return shots.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------- build
export function buildModel(p: Project): Model {
  const s = p.settings;
  const { comment, lyrics } = parseLines(p);
  const lines = [comment, ...lyrics];
  comment.t0 = s.commentAt;
  comment.t1 = commentEnd(s);
  resolveTimes(p).forEach(([t0, t1], i) => { lyrics[i].t0 = t0; lyrics[i].t1 = t1; });
  lines.forEach(schedule);

  const collabs = lyrics.filter((l) => l.who !== s.author);
  let gitLineIndex = 0;
  if (hasGitLog(s)) lines.forEach((l, i) => { if (l.t0 <= s.gitLog.at) gitLineIndex = i; });

  const rows = lines.length + EXTRA_ROWS;
  // wide enough for the longest line plus its `// name` label
  const editorW = Math.max(EDITOR_W, ...lines.map((l) => GUTTER + (l.text.length + 4 + l.who.length) * metrics.charWidth + 120));
  return {
    settings: s,
    lines,
    lyrics,
    rows,
    editorW,
    editorH: TOP + rows * LINE_H,
    shots: buildShots(s, lyrics),
    collabs,
    joinAt: collabs.length ? Math.max(0.3, collabs[0].t0 - 4) : Infinity,
    gitLineIndex,
    gitEntries: s.gitLog.entries
      .split("\n")
      .map((row) => row.split("|").map((x) => x.trim()))
      .filter((a) => a[0] || a[1])
      .map((a) => ({ year: a[0] ?? "", text: a[1] ?? "", note: a[2] ?? "", hot: (a[3] ?? "").includes("*") })),
  };
}

// ---------------------------------------------------------------- queries
/** Number of characters of `line` visible at time t. */
export function typedCount(line: CodeLine, t: number) {
  if (t < line.t0) return 0;
  const ev = line.charTimes;
  let lo = 0, hi = ev.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (ev[m] <= t) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/** Index (into model.lines) of the line being typed at time t. */
export function activeLineIndex(m: Model, t: number) {
  let li = 0;
  for (let i = 0; i < m.lines.length; i++) if (t >= m.lines[i].t0) li = i;
  return li;
}
