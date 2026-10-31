import { useEffect, useMemo, useRef, useState } from "react";
import { buildModel } from "./engine";
import { baseName } from "./shared/math";
import { useExporter } from "./hooks/useExporter";
import { useKeyboard } from "./hooks/useKeyboard";
import { usePlayer } from "./hooks/usePlayer";
import { useProject } from "./hooks/useProject";
import { useRenderer } from "./hooks/useRenderer";
import { useTapSync } from "./hooks/useTapSync";
import { Timeline } from "./components/Timeline";
import { Transport } from "./components/Transport";
import { ProjectPanel } from "./components/panels/ProjectPanel";
import { EndingPanel, GitLogPanel, StylePanel, TemplatePanel, TextPanel } from "./components/panels/SettingsPanels";
import { SongPanel } from "./components/panels/SongPanel";
import { TimingPanel } from "./components/panels/TimingPanel";

export default function App() {
  const { project, actions } = useProject();
  const model = useMemo(() => buildModel(project), [project]);
  const player = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { rendererRef, error, invalidate } = useRenderer(canvasRef, model, player);
  const exporter = useExporter(canvasRef, rendererRef, player);
  const [selected, setSelected] = useState(0);
  const tap = useTapSync(model, player, actions, selected, setSelected);
  const s = project.settings;

  useEffect(() => player.setDuration(s.duration), [player, s.duration]);
  useEffect(() => player.setOffset(s.audioStart), [player, s.audioStart]);

  useKeyboard({
    Space: () => (tap.active ? tap.tap() : player.toggle()),
    Escape: () => tap.stop(),
    ArrowLeft: (e) => player.seek(player.time() - (e.shiftKey ? 5 : 1)),
    ArrowRight: (e) => player.seek(player.time() + (e.shiftKey ? 5 : 1)),
  });

  const code = s.template === "code";
  const panelProps = { s, actions, lineCount: model.lyrics.length };
  return (
    <div className="app">
      <aside className="side">
        <header>
          <h1>lyric<b>.</b>studio<b>(</b>video<b>)</b></h1>
          <p>Load a song (up to 2 minutes), check the lyrics, export.</p>
        </header>
        <TemplatePanel {...panelProps} />
        <SongPanel player={player} actions={actions} />
        <TimingPanel project={project} model={model} actions={actions} player={player} selected={selected} onSelect={setSelected} tap={tap} />
        {code && <TextPanel {...panelProps} />}
        {code && <GitLogPanel {...panelProps} />}
        <EndingPanel {...panelProps} />
        {code && <StylePanel {...panelProps} />}
        <ProjectPanel project={project} actions={actions} />
      </aside>

      <main className="main">
        <Transport
          player={player}
          tap={{ active: tap.active, tap: tap.tap, nextLabel: `line ${selected + 1}: ${model.lyrics[selected]?.raw ?? ""}` }}
          exportStatus={exporter.status}
          onExport={(w) => exporter.start(w, baseName(s.fileName))}
          onCancelExport={exporter.cancel}
          onResolution={(w) => { rendererRef.current?.setResolution(w); invalidate(); }}
        />
        <div className="view">
          {error ? <p className="error">{error}</p> : <canvas ref={canvasRef} width={1080} height={1920} className="preview" />}
        </div>
      </main>

      <Timeline project={project} model={model} actions={actions} player={player} selected={selected} onSelect={setSelected} />
    </div>
  );
}
