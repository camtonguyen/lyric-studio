import { useState } from "react";
import { formatTime } from "../../shared/math";
import { usePlayerValue } from "../../hooks/usePlayer";
import type { ProjectActions } from "../../hooks/useProject";
import type { Player } from "../../audio/Player";
import { findLyrics, importSong } from "../../audio/song";
import { Section } from "../fields";

interface Status { text: string; pct?: number; failed?: boolean }

export function SongPanel({ player, actions }: { player: Player; actions: ProjectActions }) {
  const song = usePlayerValue(player, (p) => p.song);
  const volume = usePlayerValue(player, (p) => p.audio.volume);
  const [status, setStatus] = useState<Status | null>(null);
  const busy = !!status && !status.failed;
  const fail = (e: unknown) => setStatus({ text: `Failed: ${(e as Error).message}`, failed: true });

  async function extract(fresh = false) {
    let live = true; // ignore progress callbacks that arrive after we finish
    try {
      actions.setExtracted(await findLyrics(player.song!, (text, pct) => live && setStatus({ text, pct })), fresh);
      setStatus(null);
    } catch (e) { fail(e); }
    live = false;
  }

  async function onFile(file?: File) {
    if (!file) return;
    setStatus({ text: "Reading song…" });
    try {
      const s = await importSong(file);
      player.load(s);
      actions.fitToSong(s.duration, true);
    } catch (e) { return fail(e); }
    await extract(true);
  }

  return (
    <Section title="1 · Song (MP3, up to 2 min)" open>
      <input type="file" accept="audio/*" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
      <p className="hint">{song ? `${song.file.name} · ${formatTime(song.duration)}` : "No song loaded. Upload one and its lyrics are extracted automatically (first time downloads a ~1GB model)."}</p>
      <div className="btns">
        <button disabled={!song} onClick={() => actions.fitToSong(song!.duration)}>Set video length to song</button>
        <button disabled={!song} onClick={() => actions.trim(song!.peaks, song!.duration)} title="Start the song where the singing starts, end the video with the song, and re-spread the lyrics over it">Trim song to lyrics</button>
        <button disabled={!song || busy} onClick={() => confirm("Replace the current lyrics with the lyrics found in the song?") && extract()}>Re-extract lyrics</button>
      </div>
      {status?.failed && <p className="hint">{status.text}</p>}
      {busy && (
        <div className="loading">
          <div className="spinner" />
          <p>{status.text}{status.pct !== undefined && ` ${status.pct}%`}</p>
          {status.pct !== undefined && <progress max={100} value={status.pct} />}
        </div>
      )}
      <label>
        Preview volume
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => player.setVolume(+e.target.value)} />
      </label>
    </Section>
  );
}
