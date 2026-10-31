// Run: npx esbuild src/project/timing.check.ts --bundle --platform=node --packages=external | node
import { EXAMPLE_PROJECT, exampleProject, normalizeProject } from "./defaults";
import { fitDuration, resolveTimes, trimToLyrics } from "./timing";

const p = exampleProject();
console.assert(p.lines.every((l) => l.start !== null && l.end === null), "spread sets every start, clears ends");
const starts = p.lines.map((l) => l.start!);
console.assert(starts.every((v, i) => !i || v > starts[i - 1]), "starts increase");
const g = p.settings.gitLog;
console.assert(!starts.some((v) => v > g.at - 0.2 && v < g.at + g.duration), "nothing starts during the git log");

// resolved times honour explicit starts/ends and fill gaps
const q = { ...p, lines: p.lines.map((l, i) => (i === 2 ? { ...l, start: null } : i === 3 ? { ...l, end: starts[3] + 2 } : l)) };
const t = resolveTimes(q);
console.assert(t[2][0] > t[1][0] && t[2][0] < t[3][0], "gap interpolated");
console.assert(t[3][1] === starts[3] + 2, "explicit end kept");
console.assert(t.every(([a, b]) => b > a), "ends after starts");

// fit: ending keeps its distance from the end
const f = fitDuration(p, 40);
console.assert(f.settings.duration === 40 && Math.abs(f.settings.ending.at - (p.settings.ending.at + 10)) < 0.01, "fit");

// trim: 40s song, silence until 8s, loud from 8s to 36s
const peaks = new Float32Array(4000).map((_, i) => (i >= 800 && i < 3600 ? 0.8 : 0.01));
const tr = trimToLyrics(p, peaks, 40);
const first = tr.lines[0].start!;
console.assert(Math.abs(tr.settings.audioStart + first - 8) < 0.02, "first line lands on the first sound");
console.assert(Math.abs(tr.settings.audioStart + tr.settings.duration - 37.5) < 0.02, "video ends with the song");
console.assert(tr.settings.ending.at < tr.settings.duration, "ending inside video");

// old saved projects load
const old = normalizeProject({ lyrics: "a\nb\n\nc", timings: [{ start: 1, end: null }, null, { start: 5, end: 6 }], authors: ["x", "", null] });
console.assert(old.lines.length === 3 && old.lines[0].who === "x" && old.lines[1].who === null && old.lines[2].end === 6 && old.lines[2].newVerse, "migrate");
console.assert(normalizeProject(null).lines.length === EXAMPLE_PROJECT.lines.length, "empty input → example");
console.log("timing ok");
console.assert(normalizeProject({ lines: [null, { text: 5 }, { text: "ok" }] }).lines.length === 1, "malformed saved lines are dropped");
