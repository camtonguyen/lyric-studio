import { FPS } from "../engine";
import type { Renderer } from "../engine";
import type { Player } from "../audio/Player";

const MIME_TYPES = [
  'video/mp4;codecs="avc1.640028,mp4a.40.2"',
  'video/mp4;codecs="avc1.42E01F,mp4a.40.2"',
  "video/mp4",
  'video/webm;codecs="vp9,opus"',
  'video/webm;codecs="vp8,opus"',
  "video/webm",
];

export interface RecordOptions {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  player: Player;
  width: number;
  signal: AbortSignal;
  onProgress(p: number): void;
}

/**
 * Real-time export: plays the video from the start while recording the
 * canvas + song with MediaRecorder. The render loop keeps drawing as usual.
 */
export async function recordVideo({ canvas, renderer, player, width, signal, onProgress }: RecordOptions) {
  if (!window.MediaRecorder || !canvas.captureStream) throw new Error("This browser can't record video. Use Chrome or Edge.");
  player.pause();
  renderer.setResolution(width);
  player.seek(0);

  const stream = canvas.captureStream(FPS);
  player.audioTracks().forEach((t) => stream.addTrack(t));
  const mimeType = MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m));
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: width > 720 ? 16e6 : 8e6, audioBitsPerSecond: 192_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const done = new Promise<void>((resolve) => {
    const unsub = player.subscribe(() => {
      onProgress(Math.min(1, player.time() / player.duration));
      if (!player.playing) { unsub(); resolve(); }
    });
    signal.addEventListener("abort", () => player.pause());
  });

  recorder.start(500);
  player.play();
  await done;
  const stopped = new Promise((r) => (recorder.onstop = r));
  recorder.stop();
  await stopped;
  if (signal.aborted) return null;

  const type = recorder.mimeType || mimeType || "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
}
