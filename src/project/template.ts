import type { Settings } from "./types";

/** The git log moment only exists in the code template. */
export const hasGitLog = (s: Settings) => s.gitLog.enabled && s.template === "code";
