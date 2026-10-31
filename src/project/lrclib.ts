import { baseName } from "../engine/math";
import type { Segment } from "./transcribe";

interface Hit { duration: number; syncedLyrics: string | null }

/** "[01:23.45] text" lines → segments (instrumental/empty lines dropped). */
export function parseLrc(lrc: string): Segment[] {
  const out: Segment[] = [];
  for (const m of lrc.matchAll(/^\[(\d+):(\d+(?:\.\d+)?)\][ \t]*(.*)$/gm)) {
    const text = m[3].trim().toLowerCase();
    if (text) out.push({ start: +m[1] * 60 + +m[2], text });
  }
  return out;
}

/** The synced result whose length is closest to the song's, if within `tolerance` seconds. */
// ponytail: duration match only; a trimmed clip or remix won't match and falls back to Whisper
export function pickSynced(hits: Hit[], duration: number, tolerance = 5) {
  const ok = hits.filter((h) => h.syncedLyrics && Math.abs(h.duration - duration) <= tolerance);
  return ok.sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration))[0]?.syncedLyrics ?? null;
}

/** Look the song up on lrclib.net by file name. Returns null when nothing fits (or offline). */
export async function lookupLyrics(fileName: string, duration: number): Promise<Segment[] | null> {
  const q = baseName(fileName).replace(/\(.*?\)|\[.*?\]/g, " ").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!q) return null;
  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const lrc = pickSynced((await res.json()) as Hit[], duration);
    const segs = lrc ? parseLrc(lrc) : [];
    return segs.length ? segs : null;
  } catch {
    return null;
  }
}
