import type { TrailActivity } from "./taskTrailModel";

export type TrailFailureKind = "failed" | "no-result";

// Programs that only look: a nonzero exit means nothing was found or the probe was blocked,
// not that the work went wrong.
const READ_ONLY_PROGRAMS = new Set([
  "env",
  "printenv",
  "which",
  "whereis",
  "type",
  "command",
  "pwd",
  "ls",
  "cat",
  "head",
  "tail",
  "stat",
  "file",
  "wc",
  "test",
  "[",
  "find",
  "grep",
  "egrep",
  "rg",
  "ag",
  "df",
  "du",
  "id",
  "whoami",
  "uname",
  "readlink",
  "realpath",
  "echo",
  "cd",
]);
const READ_ONLY_GIT = new Set([
  "status",
  "log",
  "diff",
  "show",
  "branch",
  "rev-parse",
  "ls-files",
  "remote",
  "describe",
]);

function readOnlyCommand(command: string): boolean {
  const segments = command.split(/&&|\|\||;|\||\n/).flatMap((part) => {
    const tokens = part
      .trim()
      .split(/\s+/)
      .filter((token) => token && !/^\w+=/.test(token));
    return tokens.length > 0 ? [tokens] : [];
  });
  return (
    segments.length > 0 &&
    segments.every(([program, sub]) => {
      const name = program!.split(/[\\/]/).at(-1)!;
      return name === "git" ? READ_ONLY_GIT.has(sub ?? "") : READ_ONLY_PROGRAMS.has(name);
    })
  );
}

/**
 * Whether an activity's failure should read as a real failure (red) or as a probe that found
 * nothing (gray): searches and file reads that came back empty, environment checks and other
 * read-only commands. Anything that changes files or runs real work stays a failure.
 */
export function trailFailureKind(
  activity: Pick<TrailActivity, "kind" | "status" | "command">,
): TrailFailureKind | null {
  if (activity.status === "no_matches") return "no-result";
  if (activity.status !== "failed") return null;
  if (activity.kind === "read" || activity.kind === "search") return "no-result";
  if (activity.kind === "command" && activity.command && readOnlyCommand(activity.command))
    return "no-result";
  return "failed";
}
