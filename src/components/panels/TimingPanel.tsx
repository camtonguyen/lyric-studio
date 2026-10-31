import { useMemo } from "react";
import { activeLineIndex, collaboratorNames, type Model } from "../../engine";
import { round2 } from "../../shared/math";
import { usePlayerValue } from "../../hooks/usePlayer";
import type { ProjectActions } from "../../hooks/useProject";
import type { Player } from "../../audio/Player";
import { spread } from "../../project/timing";
import type { Project } from "../../project/types";
import { BlurInput, NumberField, NumberInput, Section } from "../fields";

interface Props {
  project: Project;
  model: Model;
  actions: ProjectActions;
  player: Player;
  selected: number;
  onSelect(i: number): void;
  tap: { active: boolean; toggle(): void };
}

export function TimingPanel({ project, model, actions, player, selected, onSelect, tap }: Props) {
  const s = project.settings;
  // index of the lyric line playing now (comment line = -1)
  const current = usePlayerValue(player, (p) => activeLineIndex(model, p.time()) - 1);
  const names = collaboratorNames(s);
  const ends = useMemo(() => project.lines.map((l) => l.end), [project.lines]);

  return (
    <Section title="2 · Lyrics & timing" open>
      <div className="btns">
        <button className={tap.active ? "on" : ""} onClick={tap.toggle}>{tap.active ? "Stop tapping" : "Tap to sync"}</button>
        <button onClick={() => (!project.lines.some((l) => l.start !== null) || confirm("Replace all line timings with an even spread?")) && actions.setLines(spread(project))}>
          Auto-spread
        </button>
        <button onClick={() => actions.setLines(project.lines.map((l) => ({ ...l, end: null })))}>Reset ends to auto</button>
        <button onClick={() => actions.setLines(project.lines.map((l) => ({ ...l, who: null })))}>Auto-assign names</button>
      </div>
      <p className="hint">
        Lyrics come from the song. Edit any line or its name (<b>by</b>), or remove a wrong line with ×.
        <b> Tap to sync:</b> select the first line to time, press play, then press <b>Space</b> as each line starts singing.
        <b> Start</b> = typing begins, <b>End</b> = typing finishes (blank = auto). You can also drag blocks on the timeline.
      </p>
      <div className="row">
        <NumberField label="Typing speed (chars/sec)" value={s.typingSpeed} min={2} max={80} step={1} onChange={(v) => actions.setSettings({ typingSpeed: Math.max(2, v) })} />
        <NumberField label="Comment line starts at (s)" value={s.commentAt} min={0} onChange={(v) => actions.setSettings({ commentAt: Math.max(0, v) })} />
      </div>
      <div className="lines">
        <table>
          <thead><tr><th /><th>line</th><th>by</th><th>start</th><th>end</th><th /></tr></thead>
          <tbody>
            {model.lyrics.map((l, i) => (
              <tr key={i} className={[i === selected && "sel", i === current && "now", tap.active && i === selected && "next"].filter(Boolean).join(" ")}
                  onClick={(e) => { onSelect(i); if (!["INPUT", "SELECT", "BUTTON"].includes((e.target as HTMLElement).tagName)) { player.pause(); player.seek(Math.max(0, l.t0 - 0.5)); } }}>
                <td className="n">{i + 1}</td>
                <td className="tx"><BlurInput value={l.raw} onCommit={(v) => actions.setLine(i, v)} /></td>
                <td className="by">
                  <select value={l.who} onChange={(e) => actions.setWho(i, e.target.value)}>
                    {[...new Set([s.author, ...names, l.who])].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td><NumberInput step={0.01} value={round2(l.t0)} onChange={(v) => v !== null && actions.setTiming(i, { start: Math.max(0, v) })} /></td>
                <td><NumberInput step={0.01} value={ends[i] ?? null} placeholder="auto" title={`auto: ${l.t1.toFixed(2)}`} onChange={(v) => actions.setTiming(i, { end: v })} /></td>
              <td><button title="Remove this line" onClick={() => actions.deleteLine(i)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
