import { linesFromText, type LyricLine } from "./lines";
import { spread } from "./timing";
import type { Project } from "./types";

export const EXAMPLE_PROJECT: Project = {
  lines: linesFromText(`the radio is humming
every song (i never sent)
the kettle and the city
are both waiting on the rain

and maybe i was early
or the summer was too short
but i kept a light on
for whoever finds the door

so if you hear it playing
somewhere far below
just know it was (for you)
and it always will be`),
  settings: {
    template: "code",
    songTitle: "Midnight",
    songArtist: "nora",
    cover: "",
    duration: 30,
    audioStart: 0,
    fileName: "midnight.js",
    comment: "for the one who stayed up late.",
    commentAt: 0.6,
    typingSpeed: 16,
    author: "nora",
    collaborators: "milo, juno, sage, remy, ivy",
    tabMessage: "saved · first time since 2019",
    tabMessageAt: 23,
    gitLog: {
      enabled: true,
      at: 15.4,
      duration: 4.6,
      command: "git log --oneline midnight.js",
      entries: "2019 | first draft | kitchen table\n2021 | (rewrote the chorus) | 3am\n2023 | almost deleted it | | *",
      counterFrom: 2023,
      counterTo: 2026,
      counterLabel: "0 commits",
    },
    ending: { enabled: true, at: 24.6, title: "MIDNIGHT", subtitle: "midnight.js · nora & friends" },
    style: {
      lyricsColor: "#b4372b",
      cursorColor: "#ff2a2a",
      collaboratorColor: "#ffc53a",
      camera: 1,
      zoom: 1,
      cutEvery: 2,
      depthBlur: 1,
      motionBlur: 1,
      grain: 0.07,
    },
  },
};

/** The example with its lines spread over the video. */
export function exampleProject(): Project {
  const p = structuredClone(EXAMPLE_PROJECT);
  return { ...p, lines: spread(p) };
}

/** Lines from a saved project, including the old format (lyrics text + parallel timings / authors arrays). */
function normalizeLines(p: { lines?: Partial<LyricLine>[]; lyrics?: string; timings?: ({ start?: number | null; end?: number | null } | null)[]; authors?: (string | null)[] }): LyricLine[] {
  if (Array.isArray(p.lines)) return p.lines.filter((l) => typeof l?.text === "string").map((l) => ({ newVerse: false, who: null, start: null, end: null, ...l }) as LyricLine);
  if (typeof p.lyrics !== "string") return structuredClone(EXAMPLE_PROJECT.lines);
  return linesFromText(p.lyrics).map((l, i) => ({
    ...l,
    who: p.authors?.[i] || null,
    start: p.timings?.[i]?.start ?? null,
    end: p.timings?.[i]?.end ?? null,
  }));
}

/** Fill in any missing fields (e.g. from an older saved project). */
export function normalizeProject(input: unknown): Project {
  const d: Project = structuredClone(EXAMPLE_PROJECT);
  const p = (input ?? {}) as Parameters<typeof normalizeLines>[0] & { settings?: Partial<Project["settings"]> };
  const s = p.settings ?? {};
  return {
    lines: normalizeLines(p),
    settings: {
      ...d.settings,
      ...s,
      gitLog: { ...d.settings.gitLog, ...(s.gitLog ?? {}) },
      ending: { ...d.settings.ending, ...(s.ending ?? {}) },
      style: { ...d.settings.style, ...(s.style ?? {}) },
    },
  };
}
