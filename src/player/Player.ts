/**
 * Playback clock + song. Plays the MP3 (if loaded) or runs a silent clock.
 * Framework-free; React subscribes through `subscribe` / `version`.
 */
import type { Song } from "../project/song";

export class Player {
  readonly audio = new Audio();
  duration = 30;
  /** Song time that plays at video time 0. */
  offset = 0;
  playing = false;
  song: Song | null = null;
  /** Bumped on every change; React uses it as the store snapshot. */
  version = 0;

  private clockT = 0;
  private clockStart = 0;
  private raf = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.audio.preload = "auto";
    this.audio.addEventListener("ended", () => this.pause());
  }

  // ------------------------------------------------------------ store
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  // ------------------------------------------------------------ clock
  time() {
    if (this.song) return Math.max(0, this.audio.currentTime - this.offset);
    return this.playing ? this.clockT + (performance.now() - this.clockStart) / 1000 : this.clockT;
  }

  play() {
    if (this.playing) return;
    if (this.time() >= this.duration - 0.05) this.seek(0);
    this.playing = true;
    this.clockStart = performance.now();
    if (this.song) this.audio.play().catch((e) => { console.error(e); this.pause(); });
    this.tick();
    this.emit();
  }

  pause() {
    if (!this.playing) return;
    this.clockT = this.time();
    this.playing = false;
    cancelAnimationFrame(this.raf);
    if (this.song) this.audio.pause();
    this.emit();
  }

  toggle() { if (this.playing) this.pause(); else this.play(); }

  seek(t: number) {
    t = Math.max(0, Math.min(this.duration, t));
    if (this.song) this.audio.currentTime = t + this.offset;
    this.clockT = t;
    this.clockStart = performance.now();
    this.emit();
  }

  setDuration(d: number) { this.duration = d; }

  setOffset(o: number) {
    const t = this.time();
    this.offset = o;
    this.seek(t);
  }

  private tick = () => {
    if (!this.playing) return;
    if (this.time() >= this.duration) { this.pause(); this.seek(this.duration); return; }
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  // ------------------------------------------------------------ audio
  load(song: Song) {
    this.pause();
    URL.revokeObjectURL(this.audio.src);
    this.audio.src = URL.createObjectURL(song.file);
    this.song = song;
    this.seek(0);
  }

  setVolume(v: number) { this.audio.volume = v; this.emit(); }

  /**
   * Audio track to record alongside the video (empty without a song). Captured straight from
   * the element, so playback stays plain <audio> and can't be silenced by a suspended AudioContext.
   */
  audioTracks(): MediaStreamTrack[] {
    return this.song ? (this.audio as HTMLAudioElement & { captureStream(): MediaStream }).captureStream().getAudioTracks() : [];
  }
}
