/** Every colour and font in one place. Edit here to restyle; layout numbers live next to the code that draws them. */

const WHITE = "#fff";

/** Syntax colours of the code template's lyrics. */
export const SYNTAX = {
  punct: "#767c86",
  conj: "#ff4436",
  i: "#ff3b30",
  you: "#ffb347",
  arg: "#f2c46c",
  method: "#8db5ff",
  word: "#c3cede",
  comment: "#e2b366",
};

/** Code editor template (surface.ts) and its ending card (stage.ts). */
export const CODE = {
  bg: "#0e0f11",
  bgActive: "#15161a",
  cursorTagText: "#170606",
  collabTagText: "#1a1300",
  tabBar: "#08090a",
  tabBorder: "#1b1c20",
  tabName: "#9aa1ab",
  tabDot: "#d9dde3",
  tabMessage: "#8c929b",
  lineNumber: "#34373d",
  gitBox: "#17181c",
  gitBoxBorder: "#23252a",
  gitText: "#c9ced6",
  gitCommand: "#5d626b",
  hot: "#ff3d33",
  cold: "#c8cdd5",
  year: "#eef1f5",
  muted: "#7f858e",
  counter: "#ff2d2d",
  endTitle: "#e6e8ec",
  endRule: "#3a3d44",
};

/** Timeline blocks: [fill, stroke] per kind, plus the rest of its chrome. */
export const TIMELINE = {
  blocks: { line: ["#4a1c1a", "#c2413a"], comment: ["#3b3324", "#a1874f"], git: ["#3a2a55", "#7d5cc0"], ending: ["#5aa0ff", "#5aa0ff"] } as Record<string, [string, string]>,
  track: "#0d0e11",
  grid: "#262a33",
  tick: "#6b7079",
  collab: "#4a3d12",
  selected: "#ffc53a",
  label: "#e8e2dc",
  handle: "#ffffff55",
};

const SANS = `"Helvetica Neue", "Segoe UI", Arial, sans-serif`;

/** Streaming-app lyrics templates (lyricsView.ts). */
export const LYRICS = {
  apple: {
    font: `-apple-system, "SF Pro Display", ${SANS}`,
    bg: "#2a2e30",
    text: WHITE,
    dim: "rgba(255,255,255,.55)",
    sub: "rgba(255,255,255,.6)",
  },
  spotify: {
    font: `"Circular Std", "Gotham", ${SANS}`,
    text: WHITE,
    sub: "rgba(255,255,255,.7)",
    placeholder: "rgba(255,255,255,.12)",
    shadeTop: "rgba(0,0,0,.7)",
    shadeBottom: "rgba(0,0,0,.88)",
    track: "rgba(255,255,255,.3)",
    playIcon: "#000",
  },
  cover: {
    text: "rgba(255,255,255,.85)",
    sub: "rgba(255,255,255,.6)",
    fadeTop: "rgba(8,12,28,0)",
    fadeBottom: "rgba(8,12,28,.95)",
    card: "rgba(10,14,30,.88)",
    cardBorder: "rgba(255,255,255,.15)",
    track: "rgba(255,255,255,.2)",
    progress: "rgba(255,255,255,.7)",
  },
};
