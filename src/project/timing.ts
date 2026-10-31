/**
 * The video's timeline rules: where typing may happen, when each line starts and ends,
 * and every operation that rewrites durations or starts (fit to song, trim, even spread).
 * Pure functions on a Project; the engine only reads the result.
 */
import { lyricToCode } from "../engine/lyrics";
import { round2 } from "../engine/math";
import { isLastInVerse, verseIndexes, type LyricLine } from "./lines";
import { hasGitLog } from "./template";
import type { Project, Settings } from "./types";

const TAIL = 1.5; // seconds kept after the last audible sound

export const commentEnd = (s: Settings) => s.commentAt + (3 + s.comment.length) / s.typingSpeed;
export const typingWindowEnd = (s: Settings) => (s.ending.enabled ? s.ending.at : s.duration);
/** Earliest first-line start and latest last-line start. */
const bounds = (s: Settings): [number, number] => [(s.template === "code" ? commentEnd(s) : 0) + 0.3, typingWindowEnd(s) - 0.4];
const isSet = (v: number | null | undefined): v is number => v !== null && v !== undefined && Number.isFinite(v);

/** Spread all lines evenly over the video (last verse after the git log). Clears ends. */
export function spread(p: Project): LyricLine[] {
  const { lines, settings: s } = p;
  const [a, b] = bounds(s), g = s.gitLog;
  let groups: [from: number, to: number, t0: number, t1: number][] = [[0, lines.length, a, b]];
  if (hasGitLog(s) && g.at > a && g.at + g.duration < b) {
    const verse = verseIndexes(lines);
    let split = verse.indexOf(verse[verse.length - 1]);
    if (split <= 0) split = Math.ceil(lines.length * 0.7);
    groups = [[0, split, a, g.at - 0.2], [split, lines.length, g.at + g.duration, b]];
  }
  const out = lines.map((l) => ({ ...l, start: null, end: null }) as LyricLine);
  for (const [from, to, t0, t1] of groups) {
    const w = lines.slice(from, to).map((l, k) => lyricToCode(l.text, isLastInVerse(lines, from + k)).text.length + 8);
    const total = w.reduce((x, y) => x + y, 0) || 1;
    let acc = 0;
    w.forEach((x, k) => { out[from + k].start = round2(t0 + (acc / total) * (t1 - t0)); acc += x; });
  }
  return out;
}

/** Start and end of typing for every line; unset starts are interpolated, unset ends follow the typing speed. */
export function resolveTimes(p: Project): [start: number, end: number][] {
  const { lines, settings: s } = p, n = lines.length;
  const [lo, hi] = bounds(s);
  const st: (number | null)[] = lines.map((l) => (isSet(l.start) ? l.start : null));
  for (let i = 0; i < n; i++) {
    if (st[i] !== null) continue;
    let j = i;
    while (j < n && st[j] === null) j++;
    const a = i > 0 ? st[i - 1]! : lo;
    const b = j < n ? st[j]! : Math.max(a + 0.5, hi);
    const segs = i > 0 ? j - i + 1 : Math.max(1, j - i);
    for (let k = i; k < j; k++) st[k] = a + ((b - a) * (k - i + (i > 0 ? 1 : 0))) / segs;
  }
  const starts = st as number[];
  return starts.map((start, i) => {
    const end = lines[i].end;
    if (isSet(end) && end > start + 0.05) return [start, end];
    let next = i + 1 < n ? starts[i + 1] : typingWindowEnd(s);
    if (hasGitLog(s) && s.gitLog.at > start && s.gitLog.at < next) next = s.gitLog.at;
    const typed = lyricToCode(lines[i].text, isLastInVerse(lines, i)).text.trim().length;
    return [start, start + Math.max(0.25, Math.min(typed / s.typingSpeed, next - start - 0.15))];
  });
}

/** Set the video length, keeping the ending the same distance from the end. */
export function fitDuration(p: Project, d: number): Project {
  if (!d) return p;
  const s = p.settings, duration = round2(d);
  const ending = s.ending.enabled ? { ...s.ending, at: round2(Math.max(1, s.ending.at + duration - s.duration)) } : s.ending;
  return { ...p, settings: { ...s, duration, ending } };
}

/** First/last time (s) the song is louder than 15% of its peak; `peaks` is loudness per 10ms. */
function audibleRange(peaks: Float32Array, length: number): [number, number] {
  let max = 0;
  for (const v of peaks) max = Math.max(max, v);
  const lo = peaks.findIndex((v) => v > max * 0.15);
  let hi = peaks.length - 1;
  while (hi > lo && peaks[hi] <= max * 0.15) hi--;
  return lo < 0 ? [0, length] : [lo / 100, Math.min(length, hi / 100)];
}

/**
 * Fit the song to the lyrics without tapping: start the song so its first audible sound lands
 * on the first lyric line, end the video with the song, then spread the lyrics over the result.
 * (Replaces all line timings; re-tap afterwards to fine-tune.)
 */
export function trimToLyrics(p: Project, peaks: Float32Array | null, songLength: number): Project {
  const [onset, end] = peaks ? audibleRange(peaks, songLength) : [0, songLength];
  const firstLine = spread(p)[0]?.start ?? 0; // where line 1 starts in the video
  const audioStart = round2(Math.max(0, onset - firstLine));
  const duration = Math.max(5, Math.min(songLength, end + TAIL) - audioStart);
  const next = fitDuration({ ...p, settings: { ...p.settings, audioStart } }, duration);
  return { ...next, lines: spread(next) };
}
