/**
 * Getting a song into the app: read the file once (length check, decode, loudness), then find
 * its lyrics from the first source that has them.
 */
import { formatTime } from "../engine/math";
import { lookupLyrics } from "./lrclib";
import { transcribe, type Segment } from "./transcribe";

export const MAX_SECONDS = 120;

export interface Song {
  file: File;
  duration: number;
  buffer: AudioBuffer;
  /** Loudness per 10ms, for the timeline waveform and trimming. */
  peaks: Float32Array;
}

/** Progress text, with a 0–100 percentage when there is one. */
export type Progress = (text: string, pct?: number) => void;

/** Where lyrics can come from. Returns null when it has none for this song. */
export type LyricSource = (song: Song, onProgress: Progress) => Promise<Segment[] | null>;

const lrclib: LyricSource = (song) => lookupLyrics(song.file.name, song.duration);
const whisper: LyricSource = (song, onProgress) => transcribe(song, onProgress);

/** NaN if the browser can't play the file. Cheap, so a huge file is rejected before it is decoded. */
function playableLength(file: File) {
  return new Promise<number>((done) => {
    const url = URL.createObjectURL(file), a = new Audio(url);
    const end = (d: number) => { URL.revokeObjectURL(url); done(d); };
    a.onloadedmetadata = () => end(a.duration);
    a.onerror = () => end(NaN);
  });
}

export async function importSong(file: File): Promise<Song> {
  const length = await playableLength(file);
  if (!Number.isFinite(length)) throw new Error("this browser can't play that audio file");
  if (length > MAX_SECONDS) throw new Error(`song must be ${MAX_SECONDS / 60} minutes or shorter (this one is ${formatTime(length)})`);
  // an offline context decodes without autoplay/suspend problems
  const buffer = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await file.arrayBuffer()).catch(() => {
    throw new Error("couldn't decode that audio file");
  });
  return { file, duration: buffer.duration, buffer, peaks: computePeaks(buffer) };
}

function computePeaks(buf: AudioBuffer) {
  const ch = buf.getChannelData(0), per = Math.floor(buf.sampleRate / 100);
  const peaks = new Float32Array(Math.ceil(ch.length / per));
  for (let i = 0; i < peaks.length; i++) {
    let m = 0;
    for (let j = i * per, e = Math.min(ch.length, j + per); j < e; j += 4) m = Math.max(m, Math.abs(ch[j]));
    peaks[i] = m;
  }
  return peaks;
}

/** Lyrics from the first source that has some: looked up online by file name, else transcribed from the song. */
export async function findLyrics(song: Song, onProgress: Progress, sources: LyricSource[] = [lrclib, whisper]): Promise<Segment[]> {
  onProgress("Looking up lyrics…");
  for (const source of sources) {
    const segs = await source(song, onProgress);
    if (segs?.length) return segs;
  }
  throw new Error("no singing found");
}
