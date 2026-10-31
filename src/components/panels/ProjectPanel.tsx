import { useRef } from "react";
import type { ProjectActions } from "../../hooks/useProject";
import { exampleProject } from "../../project/defaults";
import { exportProjectFile, readProjectFile } from "../../project/storage";
import type { Project } from "../../project/types";
import { Section } from "../fields";

export function ProjectPanel({ project, actions }: { project: Project; actions: ProjectActions }) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function onLoad(file?: File) {
    if (!file) return;
    try { actions.replace(await readProjectFile(file)); } catch { alert("That file isn't a valid project."); }
    if (fileRef.current) fileRef.current.value = "";
  }

  function reset() {
    if (!confirm("Replace everything with the example project?")) return;
    actions.replace(exampleProject());
  }

  return (
    <Section title="7 · Project">
      <div className="btns">
        <button onClick={() => exportProjectFile(project)}>Save project (.json)</button>
        <button onClick={() => fileRef.current?.click()}>Load project</button>
        <button onClick={reset}>Reset to example</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onLoad(e.target.files?.[0])} />
      </div>
      <p className="hint">
        Projects save lyrics, timing and settings, but not the MP3. Load the song again after opening a project.
        Work is also autosaved in this browser. The JSON file also works with <code>npm run render</code>.
      </p>
    </Section>
  );
}
