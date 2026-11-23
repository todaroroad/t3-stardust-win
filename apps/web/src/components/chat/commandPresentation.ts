import { uiText } from "../../i18n";
export interface CommandPresentation {
  label: string;
  path?: string;
  program?: string;
}
function words(source: string): string[] {
  const result: string[] = [];
  let word = "",
    quote = "",
    active = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (ch === "\\" && quote !== "'" && i + 1 < source.length) {
      word += source[++i];
      active = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = "";
      else word += ch;
      active = true;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      active = true;
      continue;
    }
    if (/[<>]/.test(ch)) {
      if (active && !/^\d+$/.test(word)) result.push(word);
      return result;
    }
    if (/[;&|\n]/.test(ch)) {
      if (active) result.push(word);
      return result;
    }
    if (/\s/.test(ch)) {
      if (active) result.push(word);
      word = "";
      active = false;
    } else {
      word += ch;
      active = true;
    }
  }
  if (active && word) result.push(word);
  return result;
}
export function unwrapCommand(raw: string): string {
  let source = raw.trim();
  for (let i = 0; i < 4; i++) {
    const tokens = words(source),
      program = tokens[0]?.split(/[\\/]/).at(-1);
    if (program && /^(?:zsh|bash|sh|fish)$/.test(program)) {
      const index = tokens.findIndex((t) => /^-[a-z]*c[a-z]*$/.test(t));
      if (index >= 0 && tokens[index + 1]) {
        source = tokens[index + 1]!;
        continue;
      }
    }
    break;
  }
  return source;
}
function meaningfulCommand(raw: string): { source: string; directory: string | undefined } {
  const rawSource = unwrapCommand(raw);
  let quote = "",
    start = 0,
    directory: string | undefined;
  for (let i = 0; i <= rawSource.length; i++) {
    const char = rawSource[i];
    if (char === "\\" && quote !== "'") {
      i++;
      continue;
    }
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (i !== rawSource.length && char !== ";" && !(char === "&" && rawSource[i + 1] === "&"))
      continue;
    const part = rawSource.slice(start, i).trim();
    const tokens = words(part);
    while (tokens[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
    const program = tokens[0];
    if (program && !["cd", "pushd", "export", "set", "umask"].includes(program))
      return { source: /<<\s*['"]?\w+/.test(part) ? rawSource.slice(start) : part, directory };
    if ((program === "cd" || program === "pushd") && tokens[1]) {
      const path = tokens.find((token, index) => index > 0 && !token.startsWith("-"));
      if (path) directory = path.startsWith("/") || !directory ? path : `${directory}/${path}`;
    }
    if (char === "&") i++;
    start = i + 1;
  }
  return { source: rawSource, directory };
}
export function commandPresentation(raw: string, description?: string | null): CommandPresentation {
  const { source, directory } = meaningfulCommand(raw);
  const result = presentCommand(source, description);
  if (!directory || (result.path && /^(?:\/|~|[A-Za-z]:)/.test(result.path))) return result;
  return { ...result, path: result.path ? `${directory}/${result.path}` : directory };
}
function presentCommand(raw: string, description?: string | null): CommandPresentation {
  const source = unwrapCommand(raw),
    tokens = words(source);
  while (tokens[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
  const program = tokens[0]?.split(/[\\/]/).at(-1) || uiText("Command");
  const supplied = description?.trim();
  if (
    supplied &&
    !/^(?:(?:(?:Running|Run|Ran)\s+)?(?:Bash|Shell|Command|Terminal|exec_command|shell_command|run_command|run_terminal_command))$/i.test(
      supplied,
    ) &&
    supplied !== program &&
    supplied !== uiText("Run command {program}", { program }) &&
    supplied !== raw.trim()
  )
    return { label: supplied };
  const args = tokens.slice(1);
  if (/^(df|du)$/.test(program) || /\bstatvfs\s*\(/.test(source))
    return { label: uiText("Check disk space") };
  if (/^(cat|head|tail|sed)$/.test(program))
    return {
      label: uiText("Read"),
      ...(args.filter((t) => !t.startsWith("-")).at(-1)
        ? { path: args.filter((t) => !t.startsWith("-")).at(-1)! }
        : {}),
    };
  if (/^(rg|grep)$/.test(program)) {
    const optionsWithValue = new Set([
      "-g",
      "--glob",
      "-t",
      "--type",
      "--type-not",
      "-A",
      "-B",
      "-C",
      "--context",
      "-m",
      "--max-count",
      "--include",
      "--exclude",
    ]);
    let pattern: string | undefined;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
      if (optionsWithValue.has(arg)) {
        i++;
        continue;
      }
      if (arg === "-e" || arg === "--regexp") {
        pattern = args[i + 1];
        break;
      }
      if (!arg.startsWith("-")) {
        pattern = arg;
        break;
      }
    }
    return { label: pattern ? uiText("Search “{pattern}”", { pattern }) : uiText("Search files") };
  }
  if (/^(ls|find)$/.test(program))
    return { label: uiText("View"), path: args.find((t) => !t.startsWith("-")) ?? "." };
  if (/^(vp|pnpm|npm|yarn|bun)$/.test(program) && args.some((t) => t === "test" || t === "vitest"))
    return { label: uiText("Run tests") };
  if (
    program === "tsc" ||
    program === "tsgo" ||
    program === "effect-tsgo" ||
    args.some((t) => /^(lint|typecheck|tsc|check)$/.test(t))
  )
    return { label: uiText("Check code") };
  if (program === "build" || args.includes("build")) return { label: uiText("Build") };
  if (/^python[\d.]*$/.test(program) && /<<\s*['"]?\w+/.test(source)) {
    const comment = source
      .split("\n")
      .slice(1)
      .find((line) => line.trim())
      ?.trim();
    return {
      label: comment?.startsWith("#")
        ? uiText("Run script · {count}", { count: comment.replace(/^#+\s*/, "") })
        : uiText("Run a script"),
    };
  }
  return { label: uiText("Run command"), program };
}
export function visibleActivities<T extends { status?: string }>(activities: readonly T[]) {
  if (activities.length <= 5) return { visible: activities, hidden: 0 };
  const visible = activities.filter((a, i) => i >= activities.length - 4 || a.status === "failed");
  return { visible, hidden: activities.length - visible.length };
}

export function commandTestResult(label: string, status: string, output?: string): string {
  if (label !== uiText("Run tests")) return label;
  if (status === "completed") return uiText("Run tests (passed)");
  const failures =
    output?.match(/\bTests\s+(\d+) failed/i)?.[1] ?? output?.match(/failures=(\d+)/)?.[1];
  return status === "failed" && failures
    ? uiText("Run tests (failed {failures})", { failures })
    : label;
}

export function middleTruncateFilename(path: string, max = 26): string {
  const name =
    path
      .replace(/[\\/]$/, "")
      .split(/[\\/]/)
      .at(-1) || path;
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const suffix = dot > 0 ? name.slice(dot) : "";
  const tail = Math.min(name.length - 1, Math.max(suffix.length + 3, Math.floor((max - 1) / 2)));
  return `${name.slice(0, Math.max(3, max - tail - 1))}…${name.slice(-tail)}`;
}
