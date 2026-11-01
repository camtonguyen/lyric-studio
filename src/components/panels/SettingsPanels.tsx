/** Simple form panels: text & names, git log, ending, style. */
import type { ProjectActions } from "../../hooks/useProject";
import type { Settings, Template } from "../../project/types";
import { Check, ColorField, NumberField, Section, Slider, TextField } from "../fields";

interface P { s: Settings; actions: ProjectActions; lineCount: number }

const TEMPLATES: [Template, string][] = [["code", "Code editor"], ["apple", "Apple Music lyrics"], ["spotify", "Spotify lyrics"], ["cover", "Cover lyrics (flip)"]];

/** Centre-crop to a 256px square JPEG so the data URL stays small in the project file. */
async function pickCover(file: File | undefined, set: ProjectActions["setSettings"]) {
  if (!file) return;
  const bmp = await createImageBitmap(file);
  const n = Math.min(bmp.width, bmp.height), cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  cv.getContext("2d")!.drawImage(bmp, (bmp.width - n) / 2, (bmp.height - n) / 2, n, n, 0, 0, 256, 256);
  set({ cover: cv.toDataURL("image/jpeg", 0.85) });
}

export function TemplatePanel({ s, actions: a }: P) {
  return (
    <Section title="Template" open>
      <label>
        Look of the video (lyrics, timing and song stay as they are)
        <select value={s.template} onChange={(e) => a.setSettings({ template: e.target.value as Template })}>
          {TEMPLATES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      {s.template !== "code" && (
        <>
          <ColorField label="Background colour" value={s.style.lyricsColor} onChange={(v) => a.setStyle({ lyricsColor: v })} />
          <div className="row">
            <TextField label="Song title" value={s.songTitle} onChange={(v) => a.setSettings({ songTitle: v })} />
            <TextField label="Artist" value={s.songArtist} onChange={(v) => a.setSettings({ songArtist: v })} />
          </div>
          <div className="btns">
            <label className="inline">Album art <input type="file" accept="image/*" onChange={(e) => pickCover(e.target.files?.[0], a.setSettings)} /></label>
            {s.cover && <button onClick={() => a.setSettings({ cover: "" })}>Remove art</button>}
          </div>
        </>
      )}
    </Section>
  );
}

export function TextPanel({ s, actions: a }: P) {
  return (
    <Section title="3 · Text & names">
      <TextField label="File name (editor tab)" value={s.fileName} onChange={(v) => a.setSettings({ fileName: v })} />
      <TextField label="Comment (first line)" value={s.comment} onChange={(v) => a.setSettings({ comment: v })} />
      <TextField label="Main cursor name" value={s.author} onChange={(v) => a.setSettings({ author: v })} />
      <TextField label="Collaborator names (comma-separated, 5+)" value={s.collaborators} onChange={(v) => a.setSettings({ collaborators: v })} />
      <p className="hint">Every 3rd line is typed by a collaborator in turn; change any line's name in the lyrics table.</p>
      <div className="row">
        <TextField label="Tab bar message" value={s.tabMessage} onChange={(v) => a.setSettings({ tabMessage: v })} />
        <NumberField label="Message appears at (s)" value={s.tabMessageAt} onChange={(v) => a.setSettings({ tabMessageAt: v })} />
      </div>
    </Section>
  );
}

export function GitLogPanel({ s, actions: a }: P) {
  const g = s.gitLog;
  return (
    <Section title="4 · Git log moment">
      <Check label="Show git log" value={g.enabled} onChange={(v) => a.setGitLog({ enabled: v })} />
      <div className="row">
        <NumberField label="Starts at (s)" value={g.at} min={0} onChange={(v) => a.setGitLog({ at: Math.max(0, v) })} />
        <NumberField label="Duration (s)" value={g.duration} min={1} onChange={(v) => a.setGitLog({ duration: Math.max(1, v) })} />
      </div>
      <TextField label="Command" value={g.command} onChange={(v) => a.setGitLog({ command: v })} />
      <label>
        Entries: year | text | note | * (red)
        <textarea rows={4} spellCheck={false} value={g.entries} onChange={(e) => a.setGitLog({ entries: e.target.value })} />
      </label>
      <div className="row3">
        <NumberField label="Counter from" value={g.counterFrom} step={1} onChange={(v) => a.setGitLog({ counterFrom: v })} />
        <NumberField label="to" value={g.counterTo} step={1} onChange={(v) => a.setGitLog({ counterTo: v })} />
        <TextField label="label" value={g.counterLabel} onChange={(v) => a.setGitLog({ counterLabel: v })} />
      </div>
    </Section>
  );
}

export function EndingPanel({ s, actions: a }: P) {
  const e = s.ending;
  return (
    <Section title="5 · Ending (title card)">
      <Check label="End with a title card" value={e.enabled} onChange={(v) => a.setEnding({ enabled: v })} />
      <div className="row">
        <NumberField label="Ending starts at (s)" value={e.at} min={0} onChange={(v) => a.setEnding({ at: Math.max(0, v) })} />
        <NumberField label="Video length (s)" value={s.duration} min={3} onChange={(v) => a.setSettings({ duration: Math.max(3, v) })} />
      </div>
      <TextField label="Title" value={e.title} onChange={(v) => a.setEnding({ title: v })} />
      <TextField label="Subtitle" value={e.subtitle} onChange={(v) => a.setEnding({ subtitle: v })} />
    </Section>
  );
}

export function StylePanel({ s, actions: a }: P) {
  const st = s.style;
  return (
    <Section title="6 · Style">
      <div className="row">
        <ColorField label="Main cursor" value={st.cursorColor} onChange={(v) => a.setStyle({ cursorColor: v })} />
        <ColorField label="Collaborator" value={st.collaboratorColor} onChange={(v) => a.setStyle({ collaboratorColor: v })} />
      </div>
      <Slider label="Camera movement" value={st.camera} min={0} max={1.6} step={0.05} onChange={(v) => a.setStyle({ camera: v })} />
      <Slider label="Zoom" value={st.zoom} min={0.6} max={1.5} step={0.05} onChange={(v) => a.setStyle({ zoom: v })} />
      <NumberField label="Camera cut every N lines" value={st.cutEvery} min={1} max={12} step={1} onChange={(v) => a.setStyle({ cutEvery: Math.max(1, Math.round(v)) })} />
      <Slider label="Depth blur" value={st.depthBlur} min={0} max={2} step={0.05} onChange={(v) => a.setStyle({ depthBlur: v })} />
      <Slider label="Motion blur" value={st.motionBlur} min={0} max={2} step={0.05} onChange={(v) => a.setStyle({ motionBlur: v })} />
      <Slider label="Film grain" value={st.grain} min={0} max={0.2} step={0.01} onChange={(v) => a.setStyle({ grain: v })} />
    </Section>
  );
}
