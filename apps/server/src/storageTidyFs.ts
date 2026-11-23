// @effect-diagnostics nodeBuiltinImport:off extendsNativeError:off - bounded host filesystem work behind fixed guards; the client never supplies paths.
// Guards shared by every removal in 存储与清理: the target is not a link, stays on one volume,
// belongs to the current user, fits a node and time budget, and has not changed since the scan.
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import { IN_USE_WINDOW_MS, isRescueAsset } from "./storageTidyModel.ts";

/** A guard refusal. `code` is a stable id the page translates; `message` stays for logs. */
export class TidyGuardError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}
export const guardCode = (error: unknown): string =>
  error instanceof TidyGuardError
    ? error.code
    : error instanceof Error
      ? `error:${error.message.slice(0, 160)}`
      : "error";

export const isInside = (child: string, parent: string) => {
  const relative = NodePath.relative(parent, child);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + NodePath.sep) &&
    !NodePath.isAbsolute(relative)
  );
};

export type Measure = {
  bytes: number;
  files: number;
  latest: number;
  dev: number;
  assets: number;
  assetBytes: number;
};

export type MeasureOptions = {
  readonly deadline: number;
  readonly maxNodes: number;
  readonly uid: number | null;
  readonly now: () => number;
  /** Also count the visual assets "先抢救" would copy. */
  readonly tallyAssets?: boolean;
};

/**
 * Walks a tree without following links. A symlink at the root is refused; links inside are never
 * followed and are removed as links. Files with other hard links are not counted: deleting one name
 * frees nothing. Any other node on a different volume, owned by someone else, or special aborts.
 */
export async function measureTree(root: string, options: MeasureOptions): Promise<Measure> {
  const rootStat = await NodeFSP.lstat(root);
  if (rootStat.isSymbolicLink() || (await NodeFSP.realpath(root)) !== root)
    throw new TidyGuardError("path-link");
  if (options.uid !== null && rootStat.uid !== options.uid) throw new TidyGuardError("not-owned");
  const measure: Measure = {
    bytes: 0,
    files: 0,
    latest: rootStat.mtimeMs,
    dev: rootStat.dev,
    assets: 0,
    assetBytes: 0,
  };
  let nodes = 0;
  const pending: Array<{ path: string; relative: string; stat: typeof rootStat }> = [
    { path: root, relative: "", stat: rootStat },
  ];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (options.now() > options.deadline || ++nodes > options.maxNodes)
      throw new TidyGuardError("scan-budget");
    const st = current.stat;
    if (st.isSymbolicLink()) continue;
    if (st.dev !== rootStat.dev) throw new TidyGuardError("cross-volume");
    if (!st.isFile() && !st.isDirectory()) throw new TidyGuardError("special-file");
    if (options.uid !== null && st.uid !== options.uid) throw new TidyGuardError("not-owned");
    measure.latest = Math.max(measure.latest, st.mtimeMs);
    if (st.isFile()) {
      measure.files++;
      if (st.nlink === 1) measure.bytes += st.blocks * 512;
      if (options.tallyAssets && isRescueAsset(current.relative)) {
        measure.assets++;
        measure.assetBytes += st.size;
      }
      continue;
    }
    measure.bytes += st.blocks * 512;
    const names = await NodeFSP.readdir(current.path);
    if (names.length + nodes > options.maxNodes) throw new TidyGuardError("scan-budget");
    for (let start = 0; start < names.length; start += 256) {
      const chunk = names.slice(start, start + 256);
      const stats = await Promise.all(
        chunk.map((name) => NodeFSP.lstat(NodePath.join(current.path, name))),
      );
      for (const [index, name] of chunk.entries()) {
        pending.push({
          path: NodePath.join(current.path, name),
          relative: current.relative === "" ? name : NodePath.join(current.relative, name),
          stat: stats[index]!,
        });
      }
    }
  }
  return measure;
}

/** Re-checks one path right before it is touched. */
export async function verifyForRemoval(
  path: string,
  stamp: { readonly latest: number },
  allowedRoots: ReadonlyArray<string>,
  options: MeasureOptions,
): Promise<Measure> {
  if (!NodePath.isAbsolute(path) || NodePath.normalize(path) !== path)
    throw new TidyGuardError("path-invalid");
  if (!allowedRoots.some((root) => isInside(path, root)))
    throw new TidyGuardError("outside-allowed-roots");
  const measure = await measureTree(path, options);
  if (measure.latest > stamp.latest) throw new TidyGuardError("changed-since-scan");
  if (options.now() - measure.latest < IN_USE_WINDOW_MS) throw new TidyGuardError("in-use");
  return measure;
}

/** Trash folder on the same volume as `path`: `~/.Trash`, or `<mount>/.Trashes/<uid>` on another disk. */
export async function trashDirectoryFor(
  path: string,
  home: string,
  uid: number | null,
): Promise<string> {
  const target = await NodeFSP.lstat(path);
  const usable = async (directory: string) => {
    try {
      const st = await NodeFSP.lstat(directory);
      return (
        st.isDirectory() &&
        !st.isSymbolicLink() &&
        st.dev === target.dev &&
        (uid === null || st.uid === uid)
      );
    } catch {
      return false;
    }
  };
  const homeTrash = NodePath.join(home, ".Trash");
  if (await usable(homeTrash)) return homeTrash;
  let mount = NodePath.dirname(path);
  for (;;) {
    const parent = NodePath.dirname(mount);
    if (parent === mount || (await NodeFSP.lstat(parent)).dev !== target.dev) break;
    mount = parent;
  }
  const trashes = NodePath.join(mount, ".Trashes");
  const candidate = NodePath.join(trashes, String(uid ?? 0));
  if (!(await usable(candidate))) {
    // Finder creates this lazily; make it only where the volume already keeps a .Trashes folder.
    const hasTrashes = await NodeFSP.lstat(trashes).then(
      (st) => st.isDirectory() && !st.isSymbolicLink(),
      () => false,
    );
    if (hasTrashes) await NodeFSP.mkdir(candidate, { mode: 0o700 }).catch(() => undefined);
  }
  if (!(await usable(candidate))) throw new TidyGuardError("trash-unavailable");
  return candidate;
}

export type GitResult = { readonly code: number; readonly stdout: string };
export type GitRunner = (
  cwd: string,
  args: ReadonlyArray<string>,
  timeoutMs?: number,
) => Promise<GitResult | null>;

/** Read-only git with a timeout. Null means git could not run or timed out. */
export const runGit: GitRunner = (cwd, args, timeoutMs = 20_000) =>
  new Promise((resolve) => {
    NodeChildProcess.execFile(
      "git",
      [...args],
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        encoding: "buffer",
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
      },
      (error, stdout) => {
        if (error && (error as NodeJS.ErrnoException & { killed?: boolean }).killed)
          return resolve(null);
        const code = error ? Number((error as { code?: unknown }).code) : 0;
        if (error && !Number.isFinite(code)) return resolve(null);
        resolve({ code, stdout: Buffer.from(stdout).toString("utf8") });
      },
    );
  });

export type TarRunner = (
  args: ReadonlyArray<string>,
  options?: { readonly cwd?: string },
) => Promise<GitResult>;
/** Fixed `/usr/bin/tar`; arguments are built by this app, never taken from the client. */
export const runTar: TarRunner = (args, options) =>
  new Promise((resolve, reject) => {
    NodeChildProcess.execFile(
      "/usr/bin/tar",
      [...args],
      {
        ...(options?.cwd ? { cwd: options.cwd } : {}),
        timeout: 20 * 60_000,
        maxBuffer: 256 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error && typeof (error as { code?: unknown }).code !== "number") reject(error);
        else resolve({ code: error ? Number((error as { code: number }).code) : 0, stdout });
      },
    );
  });

/** Dirty file count for a work tree; null when git cannot tell (treated as dirty by callers). */
export async function gitDirtyCount(git: GitRunner, directory: string): Promise<number | null> {
  const result = await git(directory, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (!result || result.code !== 0) return null;
  return result.stdout.split("\0").filter((entry) => entry.length > 0).length;
}
