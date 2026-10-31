import type { Progress, Song } from "./song";

export interface Segment { start: number; text: string }

/** Resample a decoded song to 16 kHz mono, the input Whisper wants. */
async function mono16k(buf: AudioBuffer) {
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}

/**
 * Transcribe a song in the browser with Whisper (model downloads on first use, ~1GB).
 * Returns one segment per phrase, with song-time starts.
 */
export async function transcribe(song: Song, onStatus: Progress): Promise<Segment[]> {
  onStatus("Loading model…");
  const { pipeline } = await import("@huggingface/transformers");
  const asr = await pipeline("automatic-speech-recognition", "onnx-community/whisper-large-v3-turbo", {
    progress_callback: (p: { status: string; progress?: number }) =>
      p.status === "progress" && onStatus("Downloading model…", Math.round(p.progress ?? 0)),
  });
  onStatus("Listening to the song… (the page may freeze for a few minutes)");
  const out = (await asr(await mono16k(song.buffer), { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 })) as {
    chunks?: { text: string; timestamp: [number, number | null] }[];
  };
  const chunks = out.chunks ?? [];
  return chunks.flatMap((c, i) =>
    // drop non-speech tags Whisper emits for music: [music], (singing), ♪
    splitSegment(c.text.replace(/[\[(][^\])]*[\])]|[♪♫*]/g, "").trim().toLowerCase(), c.timestamp[0], c.timestamp[1] ?? chunks[i + 1]?.timestamp[0] ?? c.timestamp[0] + 4),
  );
}

/**
 * Whisper returns long phrases; split them into lyric-sized lines (at commas, else the middle of
 * anything over 7 words) and share the phrase's time between them by length.
 */
// ponytail: word-count heuristic; Whisper can't give word times for this model
export function splitSegment(text: string, start: number, end: number): Segment[] {
  const parts = text.split(/\s*[,;]\s*/).flatMap((p) => {
    const w = p.split(/\s+/);
    return w.length > 7 ? [w.slice(0, w.length >> 1).join(" "), w.slice(w.length >> 1).join(" ")] : [p];
  }).filter(Boolean);
  const total = parts.reduce((n, p) => n + p.length, 0) || 1;
  let acc = 0;
  return parts.map((p) => {
    const seg = { start: start + ((end - start) * acc) / total, text: p };
    acc += p.length;
    return seg;
  });
}
