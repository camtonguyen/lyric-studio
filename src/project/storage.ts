import { baseName } from "../shared/math";
import { normalizeProject } from "./defaults";
import type { Project } from "./types";

const KEY = "lyric-studio:project";

export function loadSavedProject(): Project | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeProject(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveProject(p: Project) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable – ignore */
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return a.href;
}

export function exportProjectFile(p: Project) {
  const base = baseName(p.settings.fileName) || "lyric-video";
  downloadBlob(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }), `${base}-project.json`);
}

export async function readProjectFile(file: File): Promise<Project> {
  return normalizeProject(JSON.parse(await file.text()));
}
