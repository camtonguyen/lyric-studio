/** The git log moment only exists in the code template. */
export const hasGitLog = (s: { template: string; gitLog: { enabled: boolean } }) => s.gitLog.enabled && s.template === "code";
