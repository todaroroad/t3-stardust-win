import type { uiText } from "./index";
export function chineseDuration(value: string): string {
  return value
    .replace(/(\d+)h\b/g, "$1 小时")
    .replace(/(\d+)m\b/g, "$1 分")
    .replace(/(\d+)s\b/g, "$1 秒");
}
// App-generated group summaries ("Read 2 files and ran 1 command"): the English sentence is built
// from these templates in client-runtime, so the Chinese sentence is rebuilt from the same ones.
const SUMMARY_KEYS = [
  "Thought",
  "Thought (×{count})",
  "Read {count} file",
  "Read {count} files",
  "Changed {count} file",
  "Changed {count} files",
  "Ran {count} command",
  "Ran {count} commands",
  "Created {count} thread",
  "Created {count} threads",
  "Used {count} tool",
  "Used {count} tools",
  "Received {count} update",
  "Received {count} updates",
  "Performed {count} other action",
  "Performed {count} other actions",
  "Used device controls {count} time",
  "Used device controls {count} times",
  "Used browser {count} time",
  "Used browser {count} times",
  "Searched the web {count} time",
  "Searched the web {count} times",
  "Searched code {count} time",
  "Searched code {count} times",
  "Linked {count} pull request",
  "Linked {count} pull requests",
  "Unlinked {count} pull request",
  "Unlinked {count} pull requests",
  "Watching {count} pull request",
  "Watching {count} pull requests",
  "Stopped watching {count} pull request",
  "Stopped watching {count} pull requests",
  "Checked linked pull requests",
  "Checked linked pull requests {count} times",
] as const;
const SUMMARY_PATTERNS = SUMMARY_KEYS.map((key) => ({
  key,
  pattern: new RegExp(`^${key.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace("{count}", "(\\d+)")}$`),
}));
function groupSummaryLabel(label: string, text: typeof uiText): string | null {
  const parts = label
    .split(/, and | and |, /)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  const localized: string[] = [];
  for (const part of parts) {
    const hit = SUMMARY_PATTERNS.map(({ key, pattern }) => ({
      key,
      match: pattern.exec(part),
    })).find(({ match }) => match !== null);
    if (!hit?.match) return null;
    localized.push(text(hit.key, { count: hit.match[1] ?? "" }));
  }
  // English keeps its own joined sentence.
  if (localized.every((part, index) => part === parts[index])) return null;
  const last = localized[localized.length - 1]!;
  if (localized.length === 1) return last;
  if (localized.length === 2) return text("{first} and {last}", { first: localized[0]!, last });
  const items = localized
    .slice(1, -1)
    .reduce((joined, next) => text("{first}, {next}", { first: joined, next }), localized[0]!);
  return text("{items}, and {last}", { items, last });
}
const COMMAND_VERB_LABEL = /^(Running|Ran|Failed|Declined|Stopped) (\S+)$/;
export function conversationLabel(label: string, text: typeof uiText): string {
  const commands = /^Ran (\d+) commands?(?: and used browser (\d+) times?)?$/.exec(label);
  if (commands)
    return commands[2]
      ? text("Ran {commands} commands and used browser {browser} times", {
          commands: commands[1],
          browser: commands[2],
        })
      : text("Ran {count} commands", { count: commands[1] });
  const tasks = /^Tasks (\d+)\/(\d+)(.*)$/.exec(label);
  if (tasks)
    return text("Tasks {completed}/{total}", { completed: tasks[1], total: tasks[2] }) + tasks[3];
  const oauth = /^The (.+?) MCP server requires OAuth reauthentication\. Run `([^`]+)`\.?$/.exec(
    label,
  );
  if (oauth)
    return text("{plugin} plugin needs a new login: run `{command}`", {
      plugin: oauth[1],
      command: oauth[2],
    });
  for (const prefix of ["Worked for", "Continued for", "You stopped after"])
    if (label.startsWith(prefix + " "))
      return text(prefix + " {duration}", { duration: label.slice(prefix.length + 1) });
  const direct = text(label);
  if (direct !== label) return direct;
  // "Running pnpm": live rows name the program a command runs.
  const verb = COMMAND_VERB_LABEL.exec(label);
  if (verb) {
    const program = verb[2] === "command" ? text("command") : verb[2]!;
    return text(`${verb[1]} {program}`, { program });
  }
  return groupSummaryLabel(label, text) ?? label;
}
