/**
 * The lyric lines: one record per line (text, verse break, who types it, timing).
 * Every edit goes through here so text, names and times can't drift out of step.
 */
import { round2 } from "../engine/math";
import type { Segment } from "./transcribe";

export interface LyricLine {
  text: string;
  /** A blank line comes before this one (starts a new verse). */
  newVerse: boolean;
  /** Who types it; null = automatic. */
  who: string | null;
  /** Video seconds; null = automatic. */
  start: number | null;
  end: number | null;
}

const line = (text: string, newVerse = false): LyricLine => ({ text, newVerse, who: null, start: null, end: null });

/** Plain text (blank line between verses) → lines. */
export function linesFromText(text: string): LyricLine[] {
  return text.replace(/\r/g, "").trim().split(/\n\s*\n/)
    .map((v) => v.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((v) => v.length)
    .flatMap((v, vi) => v.map((t, i) => line(t, vi > 0 && i === 0)));
}

/** Verse number of each line. */
export function verseIndexes(lines: LyricLine[]) {
  let v = 0;
  return lines.map((l, i) => (i && l.newVerse ? ++v : v));
}

export const isLastInVerse = (lines: LyricLine[], i: number) => i + 1 >= lines.length || lines[i + 1].newVerse;

export const patchLine = (lines: LyricLine[], i: number, patch: Partial<LyricLine>) =>
  lines.map((l, k) => (k === i ? { ...l, ...patch } : l));

/** Remove line i; if it opened a verse, the next line takes over the break. */
export function removeLine(lines: LyricLine[], i: number): LyricLine[] {
  const gone = lines[i];
  return lines.flatMap((l, k) => (k === i ? [] : k === i + 1 && gone.newVerse ? [{ ...l, newVerse: true }] : [l]));
}

/** Transcribed phrases → lines, with a verse break at every 7s+ pause; `audioStart` = song time at video 0. */
export function linesFromSegments(segs: Segment[], audioStart: number): LyricLine[] {
  return segs.map((s, i) => ({ ...line(s.text, i > 0 && s.start - segs[i - 1].start > 7), start: round2(Math.max(0, s.start - audioStart)) }));
}
