import { useEffect, useReducer } from "react";
import { exampleProject } from "../project/defaults";
import { linesFromSegments, patchLine, removeLine, type LyricLine } from "../project/lines";
import { loadSavedProject, saveProject } from "../project/storage";
import { fitDuration, trimToLyrics } from "../project/timing";
import type { Segment } from "../project/transcribe";
import type { EndingSettings, GitLogSettings, Project, Settings, StyleSettings } from "../project/types";

type Action =
  | { type: "lines"; value: LyricLine[] }
  | { type: "line"; index: number; patch: Partial<LyricLine> }
  | { type: "delete"; index: number }
  | { type: "extracted"; segs: Segment[]; fresh: boolean }
  | { type: "fit"; duration: number; newSong: boolean }
  | { type: "trim"; peaks: Float32Array | null; length: number }
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "gitLog"; patch: Partial<GitLogSettings> }
  | { type: "ending"; patch: Partial<EndingSettings> }
  | { type: "style"; patch: Partial<StyleSettings> }
  | { type: "replace"; value: Project };

function reducer(p: Project, a: Action): Project {
  const s = p.settings;
  switch (a.type) {
    case "lines": return { ...p, lines: a.value };
    case "line": return { ...p, lines: patchLine(p.lines, a.index, a.patch) };
    case "delete": return { ...p, lines: removeLine(p.lines, a.index) };
    case "extracted": return { ...p, settings: a.fresh ? { ...s, audioStart: 0 } : s, lines: linesFromSegments(a.segs, a.fresh ? 0 : s.audioStart) };
    case "fit": { // a new song also forgets the old song's start point; otherwise only the song left after it counts
      const q = a.newSong ? { ...p, settings: { ...s, audioStart: 0 } } : p;
      return fitDuration(q, a.duration - q.settings.audioStart);
    }
    case "trim": return trimToLyrics(p, a.peaks, a.length);
    case "settings": return { ...p, settings: { ...s, ...a.patch } };
    case "gitLog": return { ...p, settings: { ...s, gitLog: { ...s.gitLog, ...a.patch } } };
    case "ending": return { ...p, settings: { ...s, ending: { ...s.ending, ...a.patch } } };
    case "style": return { ...p, settings: { ...s, style: { ...s.style, ...a.patch } } };
    case "replace": return a.value;
  }
}

const init = () => loadSavedProject() ?? exampleProject();

/** Project state + typed actions. Autosaves to localStorage. */
export function useProject() {
  const [project, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    const id = setTimeout(() => saveProject(project), 400);
    return () => clearTimeout(id);
  }, [project]);

  const actions = {
    setLine: (index: number, text: string) => dispatch({ type: "line", index, patch: { text: text.trim() } }),
    setWho: (index: number, name: string) => dispatch({ type: "line", index, patch: { who: name.trim() || null } }),
    setTiming: (index: number, patch: Pick<Partial<LyricLine>, "start" | "end">) => dispatch({ type: "line", index, patch }),
    deleteLine: (index: number) => dispatch({ type: "delete", index }),
    setLines: (value: LyricLine[]) => dispatch({ type: "lines", value }),
    setExtracted: (segs: Segment[], fresh: boolean) => dispatch({ type: "extracted", segs, fresh }),
    fitToSong: (duration: number, newSong = false) => dispatch({ type: "fit", duration, newSong }),
    trim: (peaks: Float32Array | null, length: number) => dispatch({ type: "trim", peaks, length }),
    setSettings: (patch: Partial<Settings>) => dispatch({ type: "settings", patch }),
    setGitLog: (patch: Partial<GitLogSettings>) => dispatch({ type: "gitLog", patch }),
    setEnding: (patch: Partial<EndingSettings>) => dispatch({ type: "ending", patch }),
    setStyle: (patch: Partial<StyleSettings>) => dispatch({ type: "style", patch }),
    replace: (value: Project) => dispatch({ type: "replace", value }),
  };
  return { project, actions };
}

export type ProjectActions = ReturnType<typeof useProject>["actions"];
