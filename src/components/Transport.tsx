import { useState } from "react";
import { formatTime } from "../engine";
import type { ExportStatus } from "../hooks/useExporter";
import { usePlayerValue } from "../hooks/usePlayer";
import type { Player } from "../player/Player";

interface Props {
  player: Player;
  tap: { active: boolean; tap(): void; nextLabel: string };
  exportStatus: ExportStatus;
  onExport(width: number): void;
  onCancelExport(): void;
  onResolution(width: number): void;
}

export function Transport({ player, tap, exportStatus, onExport, onCancelExport, onResolution }: Props) {
  const time = usePlayerValue(player, (p) => p.time());
  const playing = usePlayerValue(player, (p) => p.playing);
  const [width, setWidth] = useState(1080);
  const recording = exportStatus.state === "recording";

  return (
    <div className="bar">
      <button className="primary wide" onClick={() => player.toggle()} disabled={recording}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
      <button onClick={() => { player.pause(); player.seek(0); }} disabled={recording}>⏮</button>
      <span className="time">{formatTime(time)} / {formatTime(player.duration)}</span>
      {tap.active && <button className="on" onClick={tap.tap} title={tap.nextLabel}>TAP ␣</button>}
      {tap.active && <span className="hint">Next: {tap.nextLabel}</span>}
      <span className="spacer" />
      <select value={width} disabled={recording} onChange={(e) => { setWidth(+e.target.value); onResolution(+e.target.value); }}>
        <option value={1080}>1080×1920</option>
        <option value={720}>720×1280</option>
      </select>
      {recording
        ? <button onClick={onCancelExport}>Stop export</button>
        : <button className="primary" onClick={() => onExport(width)}>Export video</button>}
      <span className="status">
        {exportStatus.state === "recording" && `Recording… ${Math.round(exportStatus.progress * 100)}%. Keep this tab visible.`}
        {exportStatus.state === "done" && <>Done. <a href={exportStatus.url} download={exportStatus.name}>Download {exportStatus.name}</a></>}
        {exportStatus.state === "error" && exportStatus.message}
      </span>
    </div>
  );
}
