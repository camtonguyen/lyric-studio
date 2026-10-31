import type { LyricLine } from "./lines";

/** Everything the user can edit. Saved as JSON (the song file is not included). */
export interface Project {
  lines: LyricLine[];
  settings: Settings;
}

export type Template = "code" | "apple" | "spotify";

export interface Settings {
  template: Template;
  /** Header of the Apple / Spotify templates. `cover` is a small JPEG data URL ("" = none). */
  songTitle: string;
  songArtist: string;
  cover: string;
  duration: number;
  /** Where in the song the video starts (seconds). Video time t plays song time t + audioStart. */
  audioStart: number;
  fileName: string;
  comment: string;
  commentAt: number;
  typingSpeed: number; // characters per second
  author: string;
  /** Comma-separated collaborator names. */
  collaborators: string;
  tabMessage: string;
  tabMessageAt: number;
  gitLog: GitLogSettings;
  ending: EndingSettings;
  style: StyleSettings;
}

export interface GitLogSettings {
  enabled: boolean;
  at: number;
  duration: number;
  command: string;
  /** One entry per line: "year | text | note | *" (* = red) */
  entries: string;
  counterFrom: number;
  counterTo: number;
  counterLabel: string;
}

export interface EndingSettings {
  enabled: boolean;
  at: number;
  title: string;
  subtitle: string;
}

export interface StyleSettings {
  /** Background colour of the Apple / Spotify lyrics templates. */
  lyricsColor: string;
  cursorColor: string;
  collaboratorColor: string;
  camera: number;
  zoom: number;
  cutEvery: number;
  depthBlur: number;
  motionBlur: number;
  grain: number;
}
