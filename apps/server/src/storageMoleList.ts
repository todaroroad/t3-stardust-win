// @effect-diagnostics nodeBuiltinImport:off globalTimers:off - runs the user's installed `mo` as a separate program and reads its preview list.
// Mole (https://github.com/tw93/Mole, GPL-3.0) is only ever invoked as an external CLI in
// preview mode; none of its code is copied or linked. The files it lists are removed by this
// app's own executor under this app's own guards.
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

/** The one and only command this app ever runs: a preview. Never add a mutating argument. */
export const MOLE_DRY_RUN_ARGS: readonly ["clean", "--dry-run"] = ["clean", "--dry-run"];
export const MOLE_TIMEOUT_MS = 90_000;

export type MoleListItem = { readonly section: string; readonly path: string };

export const moleCleanListPath = (home: string = NodeOS.homedir()) =>
  NodePath.join(home, ".config", "mole", "clean-list.txt");

const CONTROL = /[\u0000-\u001f\u007f]/;
const SIZE_LABEL = /^[\d.]+\s?[KMGTP]?i?B$/i;

/**
 * Format: `#` comment lines, `=== Name ===` section headers, and `<path>  # <size>` item lines.
 * Paths may start with `~`. The size label is Mole's estimate and is ignored: this app measures
 * every path itself before showing or deleting it.
 */
export function parseMoleCleanList(text: string, home: string): MoleListItem[] {
  const items: MoleListItem[] = [];
  let section = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const header = line.match(/^===\s*(.+?)\s*===$/);
    if (header) {
      section = header[1] ?? "";
      continue;
    }
    let pathText = line;
    const marker = line.lastIndexOf(" # ");
    if (marker > 0 && SIZE_LABEL.test(line.slice(marker + 3).trim())) {
      pathText = line.slice(0, marker).trim();
    }
    if (pathText === "" || CONTROL.test(pathText)) continue;
    if (pathText === "~") continue;
    if (pathText.startsWith("~/")) pathText = NodePath.join(home, pathText.slice(2));
    if (!NodePath.isAbsolute(pathText)) continue;
    items.push({ section, path: NodePath.normalize(pathText) });
  }
  return items;
}

/** PATH entries first, then the two places installers put it. */
export async function findMoleBinary(
  env: NodeJS.ProcessEnv = process.env,
  home: string = NodeOS.homedir(),
): Promise<string | null> {
  const directories = [
    ...(env.PATH ?? "").split(NodePath.delimiter).filter((entry) => NodePath.isAbsolute(entry)),
    NodePath.join(home, ".local", "bin"),
    "/opt/homebrew/bin",
  ];
  for (const directory of new Set(directories)) {
    const candidate = NodePath.join(directory, "mo");
    try {
      const stat = await NodeFSP.stat(candidate);
      if (!stat.isFile()) continue;
      await NodeFSP.access(candidate, NodeFSP.constants.X_OK);
      return candidate;
    } catch {
      /* Not here. */
    }
  }
  return null;
}

export type MoleRunResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "timeout" | "exit" | "spawn"; readonly message: string };

type Spawn = typeof NodeChildProcess.spawn;

/** `mo clean --dry-run` with stdin closed and a hard timeout. Output is discarded; the list file is the result. */
export function runMoleDryRun(
  binary: string,
  options: { readonly timeoutMs?: number; readonly spawn?: Spawn } = {},
): Promise<MoleRunResult> {
  const spawn = options.spawn ?? NodeChildProcess.spawn;
  const timeoutMs = options.timeoutMs ?? MOLE_TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    let stderr = "";
    const finish = (result: MoleRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    let child: NodeChildProcess.ChildProcess;
    try {
      child = spawn(binary, [...MOLE_DRY_RUN_ARGS], {
        stdio: ["ignore", "ignore", "pipe"],
        env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
      });
    } catch (error) {
      resolve({ ok: false, reason: "spawn", message: String(error) });
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* Already gone. */
      }
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* Already gone. */
        }
      }, 2000).unref();
      finish({ ok: false, reason: "timeout", message: `mo clean --dry-run > ${timeoutMs} ms` });
    }, timeoutMs);
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = (stderr + String(chunk)).slice(-500);
    });
    child.on("error", (error) => finish({ ok: false, reason: "spawn", message: String(error) }));
    child.on("close", (code) =>
      finish(
        code === 0 ? { ok: true } : { ok: false, reason: "exit", message: stderr || `exit ${code}` },
      ),
    );
  });
}

/** Runs the preview and returns the list it just wrote; a stale file from an earlier run is not used. */
export async function previewWithMole(options: {
  readonly home: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly spawn?: Spawn;
  readonly now?: () => number;
}): Promise<
  | { readonly status: "missing" }
  | { readonly status: "failed"; readonly binary: string; readonly message: string }
  | { readonly status: "found"; readonly binary: string; readonly items: MoleListItem[] }
> {
  const binary = await findMoleBinary(options.env ?? process.env, options.home);
  if (!binary) return { status: "missing" };
  const startedAt = (options.now ?? Date.now)();
  const run = await runMoleDryRun(binary, {
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.spawn ? { spawn: options.spawn } : {}),
  });
  if (!run.ok) return { status: "failed", binary, message: run.message };
  const listPath = moleCleanListPath(options.home);
  try {
    const stat = await NodeFSP.stat(listPath);
    if (stat.mtimeMs < startedAt - 2000)
      return { status: "failed", binary, message: "clean-list.txt was not updated by this run" };
    const text = await NodeFSP.readFile(listPath, "utf8");
    return { status: "found", binary, items: parseMoleCleanList(text, options.home) };
  } catch (error) {
    return { status: "failed", binary, message: String(error) };
  }
}
