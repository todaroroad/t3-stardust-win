// @effect-diagnostics nodeBuiltinImport:off globalDate:off - bounded host filesystem work behind fixed guards; the client never supplies paths.
// 存储与清理: scan → three tiers → execute with this app's own guards.
//
//  放心清   rebuildable caches, deleted directly, space returns at once.
//  看一眼   moved to Trash (this app empties its own Trash batches after seven days), undoable.
//  只提醒   shown, never touched.
//
// Deletion is decided by the fixed rules in storageTidyModel.ts. No AI model is consulted.
import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import {
  StorageTidyOperation,
  StorageTidySettings,
  type StorageTidyItem,
  type StorageTidyKind,
  type StorageTidyMole,
  type StorageTidyOutcome,
  type StorageTidyRescue,
  type StorageTidyScan,
  type StorageTidyState,
  type StorageTidyTier,
  type StorageTidyVolume,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import type { previewWithMole } from "./storageMoleList.ts";
import {
  DAY_MS,
  SESSION_ARCHIVE_AFTER_DAYS,
  TMP_STALE_MS,
  TRASH_BATCH_PREFIX,
  backupFamily,
  backupFileFamily,
  buildFamily,
  classifyWorktree,
  isAgentTmpName,
  isMoleRemovable,
  isRescueAsset,
  localDateStamp,
  moleSectionKey,
  pruneNestedPaths,
  recoverableUntil,
  splitKeepNewest,
  trashBatchName,
} from "./storageTidyModel.ts";
import {
  TidyGuardError,
  gitDirtyCount,
  guardCode,
  isInside,
  measureTree,
  trashDirectoryFor,
  verifyForRemoval,
  type GitRunner,
  type Measure,
  type TarRunner,
} from "./storageTidyFs.ts";

export type TidyRoots = {
  readonly home: string;
  readonly applications: string;
  readonly tmp: string;
  readonly stateDir: string;
  readonly rescueRoot: string;
  readonly codexSessions: string;
  readonly claudeProjects: string;
  readonly t3Data: ReadonlyArray<string>;
  /** Fallback for 我的构建目录 (T3_CLEANUP_STAGING_DIR). */
  readonly stagingDir: string;
};

export type TidyDeps = {
  readonly roots: TidyRoots;
  readonly now: () => number;
  readonly uid: number | null;
  readonly git: GitRunner;
  readonly tar: TarRunner;
  readonly mole: () => ReturnType<typeof previewWithMole>;
  /** Known rebuildable developer caches (npm, pip, Homebrew, DerivedData, …). */
  readonly devCaches: () => Promise<ReadonlyArray<{ path: string; name: string }>>;
  readonly volumes: () => Promise<ReadonlyArray<StorageTidyVolume>>;
  readonly openPath: (path: string) => Promise<void>;
  /** Free bytes on the volume holding `path`; statfs when omitted. */
  readonly freeBytes?: (path: string) => Promise<number>;
  /** Managed worktree folders (current and previous settings), read at scan time. */
  readonly worktreeDirs: () => Promise<ReadonlyArray<string>>;
  readonly scanBudgetMs?: number;
};

type Stamp = {
  path: string;
  latest: number;
  bytes: number;
  files: number;
  dev: number;
  assets: number;
  assetBytes: number;
};
type Stored = {
  item: StorageTidyItem;
  stamps: Stamp[];
  allowedRoots: string[];
  /** Directories that are git work trees: uncommitted changes are rescued from these. */
  repos: string[];
  /** For compress items: the folder the member paths are relative to. */
  archiveBase?: string;
  /** Main repositories whose worktree list needs a prune after a direct delete. */
  pruneGit?: string[];
};
type Manifest = {
  operation: StorageTidyOperation;
  moves: Array<{ original: string; trashed: string; bytes: number }>;
  batches: string[];
};

// A build folder is scanned for old generations that then move to Trash, so system locations and
// any folder that contains the home folder can never be chosen.
const UNSAFE_BUILD_DIRECTORIES = ["/System", "/usr", "/bin", "/sbin", "/etc", "/private/etc", "/Library", "/Applications"];
// Rescue copies and transcript archives are written to the same disk, so they stop well before it is full.
const MIN_FREE_AFTER_WRITE_BYTES = 1024 ** 3;
const defaultFreeBytes = async (path: string) => {
  const stats = await NodeFSP.statfs(path);
  return stats.bavail * stats.bsize;
};
const DEFAULT_SETTINGS: StorageTidySettings = { buildDirectory: "", keepNewest: 2, rescueFirst: true };
const decodeSettings = Schema.decodeUnknownSync(StorageTidySettings);
const decodeOperation = Schema.decodeUnknownSync(StorageTidyOperation);
const SAMPLE_PATHS = 8;
const MAX_SESSION_FILES = 60_000;
const MAX_RESCUE_FILE_BYTES = 200 * 1024 ** 2;
const MAX_RESCUE_TOTAL_BYTES = 4 * 1024 ** 3;

const sha = (text: string) => NodeCrypto.createHash("sha256").update(text).digest("hex");
const iso = (ms: number) => new Date(ms).toISOString();
const slug = (name: string) => name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 60) || "item";
const exists = (path: string) =>
  NodeFSP.lstat(path).then(
    () => true,
    () => false,
  );

export function createStorageTidyEngine(deps: TidyDeps) {
  const { roots } = deps;
  const recordsDir = NodePath.join(roots.stateDir, "storage-tidy");
  const settingsPath = NodePath.join(recordsDir, "settings.json");
  const operationsDir = NodePath.join(recordsDir, "operations");

  let settings: StorageTidySettings | undefined;
  let phase: StorageTidyState["phase"] = "idle";
  let progress = { checked: 0, total: 0, step: "" };
  let scanResult: StorageTidyScan | null = null;
  let stored = new Map<string, Stored>();
  let current: Manifest | null = null;
  let volumeCache: { at: number; rows: ReadonlyArray<StorageTidyVolume> } | undefined;

  const loadSettings = async (): Promise<StorageTidySettings> => {
    if (settings) return settings;
    try {
      settings = decodeSettings({
        ...DEFAULT_SETTINGS,
        ...JSON.parse(await NodeFSP.readFile(settingsPath, "utf8")),
      });
    } catch {
      settings = DEFAULT_SETTINGS;
    }
    return settings;
  };
  const effectiveBuildDirectory = async () => {
    const configured = (await loadSettings()).buildDirectory;
    const directory = configured !== "" ? configured : roots.stagingDir;
    if (directory === "" || !NodePath.isAbsolute(directory)) return "";
    try {
      const real = await NodeFSP.realpath(directory);
      const st = await NodeFSP.lstat(real);
      return st.isDirectory() && real !== NodePath.parse(real).root && real !== roots.home
        ? real
        : "";
    } catch {
      return "";
    }
  };
  const saveSettings = async (patch: Partial<StorageTidySettings>) => {
    const next = { ...(await loadSettings()), ...patch };
    if (patch.buildDirectory !== undefined && patch.buildDirectory !== "") {
      const directory = NodePath.resolve(patch.buildDirectory);
      const real = await NodeFSP.realpath(directory).catch(() => "");
      if (
        !NodePath.isAbsolute(patch.buildDirectory) ||
        real === "" ||
        real === NodePath.parse(real).root ||
        real === roots.home ||
        isInside(roots.home, real) ||
        UNSAFE_BUILD_DIRECTORIES.some((root) => real === root || isInside(real, root)) ||
        !(await NodeFSP.lstat(real)).isDirectory()
      )
        throw new TidyGuardError("build-directory-invalid");
      next.buildDirectory = real;
    }
    settings = decodeSettings(next);
    await NodeFSP.mkdir(recordsDir, { recursive: true, mode: 0o700 });
    await NodeFSP.writeFile(settingsPath, JSON.stringify(settings, null, 2), { mode: 0o600 });
  };

  // ── operations on disk ────────────────────────────────────────────────────
  const writeManifest = async (manifest: Manifest) => {
    await NodeFSP.mkdir(operationsDir, { recursive: true, mode: 0o700 });
    const target = NodePath.join(operationsDir, `${manifest.operation.id}.json`);
    const temp = `${target}.tmp`;
    await NodeFSP.writeFile(temp, JSON.stringify(manifest), { mode: 0o600 });
    await NodeFSP.rename(temp, target);
  };
  const readManifest = async (id: string): Promise<Manifest | null> => {
    if (!/^op-[0-9a-z-]+$/.test(id)) return null;
    try {
      const raw = JSON.parse(await NodeFSP.readFile(NodePath.join(operationsDir, `${id}.json`), "utf8"));
      return {
        operation: decodeOperation(raw.operation),
        moves: Array.isArray(raw.moves) ? raw.moves : [],
        batches: Array.isArray(raw.batches) ? raw.batches : [],
      };
    } catch {
      return null;
    }
  };
  const latestManifest = async (): Promise<Manifest | null> => {
    if (current) return current;
    const names = await NodeFSP.readdir(operationsDir).catch(() => []);
    for (const name of names.filter((n) => n.endsWith(".json")).toSorted().reverse()) {
      const manifest = await readManifest(name.slice(0, -5));
      if (manifest) return manifest;
    }
    return null;
  };

  /** Removes the Trash batches this app created once seven days have passed. Nothing else in Trash is touched. */
  const purgeExpired = async () => {
    const names = await NodeFSP.readdir(operationsDir).catch(() => []);
    for (const name of names.filter((n) => n.endsWith(".json"))) {
      const manifest = await readManifest(name.slice(0, -5));
      if (!manifest || manifest.operation.phase !== "completed") continue;
      const op = manifest.operation;
      if (op.undone || op.purged || op.recoverableUntil === null) continue;
      if (Date.parse(op.recoverableUntil) > deps.now()) continue;
      for (const batch of manifest.batches) {
        const parent = NodePath.dirname(batch);
        const trashes = parent === NodePath.join(roots.home, ".Trash") || /\.Trashes\/\d+$/.test(parent);
        if (!trashes || NodePath.basename(batch) !== trashBatchName(op.id)) continue;
        const st = await NodeFSP.lstat(batch).catch(() => null);
        if (!st || st.isSymbolicLink() || !st.isDirectory()) continue;
        await NodeFSP.rm(batch, { recursive: true, force: true }).catch(() => undefined);
      }
      manifest.operation = { ...op, purged: true, recoverableUntil: null };
      await writeManifest(manifest);
      if (current?.operation.id === op.id) current = manifest;
    }
  };

  const volumes = async () => {
    if (volumeCache && deps.now() - volumeCache.at < 4000) return volumeCache.rows;
    const rows = await deps.volumes().catch(() => [] as ReadonlyArray<StorageTidyVolume>);
    volumeCache = { at: deps.now(), rows };
    return rows;
  };
  const volumeFor = async (dev: number | undefined) => {
    const rows = await volumes();
    if (dev !== undefined) {
      for (const row of rows) {
        const st = await NodeFSP.stat(row.path).catch(() => null);
        if (st?.dev === dev) return row;
      }
    }
    return rows.find((row) => row.internal) ?? rows[0];
  };

  // ── scan ──────────────────────────────────────────────────────────────────
  const measureOptions = (deadline: number, tallyAssets = false) => ({
    deadline: Math.min(deadline, deps.now() + 10_000),
    maxNodes: 400_000,
    uid: deps.uid,
    now: deps.now,
    tallyAssets,
  });
  const toStamp = (path: string, m: Measure): Stamp => ({
    path,
    latest: m.latest,
    bytes: m.bytes,
    files: m.files,
    dev: m.dev,
    assets: m.assets,
    assetBytes: m.assetBytes,
  });

  const scan = async () => {
    if (phase !== "idle") return;
    phase = "scanning";
    progress = { checked: 0, total: 8, step: "mole" };
    scanResult = null;
    stored = new Map();
    const startedAt = deps.now();
    const deadline = startedAt + (deps.scanBudgetMs ?? 75_000);
    let truncated = false;
    const items: StorageTidyItem[] = [];
    const step = (name: string) => {
      progress = { ...progress, checked: progress.checked + 1, step: name };
    };
    const add = (entry: Stored) => {
      stored.set(entry.item.id, entry);
      items.push(entry.item);
    };
    const itemId = (kind: StorageTidyKind, key: string) => `tidy-${sha(`${kind}\0${key}`).slice(0, 24)}`;
    const measureMany = async (paths: ReadonlyArray<string>, tallyAssets = false) => {
      const good: Stamp[] = [];
      const skipped: Array<{ path: string; code: string }> = [];
      for (const path of paths) {
        if (deps.now() > deadline) {
          truncated = true;
          skipped.push({ path, code: "scan-budget" });
          continue;
        }
        try {
          good.push(toStamp(path, await measureTree(path, measureOptions(deadline, tallyAssets))));
        } catch (error) {
          skipped.push({ path, code: guardCode(error) });
        }
      }
      return { good, skipped };
    };
    const base = (
      kind: StorageTidyKind,
      tier: StorageTidyTier,
      group: string,
      name: string,
      tool: string,
      stamps: ReadonlyArray<Stamp>,
      extra: Partial<StorageTidyItem> & { key: string },
    ): StorageTidyItem => {
      const { key, ...rest } = extra;
      return {
        id: itemId(kind, key),
        tier,
        kind,
        group,
        name,
        tool,
        detail: {},
        lastUsed: stamps.length ? iso(Math.max(...stamps.map((s) => s.latest))) : null,
        bytes: stamps.reduce((n, s) => n + s.bytes, 0),
        fileCount: stamps.reduce((n, s) => n + s.files, 0),
        paths: stamps.slice(0, SAMPLE_PATHS).map((s) => s.path),
        pathCount: stamps.length,
        disposal: tier === "safe" ? "delete" : tier === "review" ? "trash" : "none",
        compress: false,
        dirtyFiles: 0,
        rescueAssets: stamps.reduce((n, s) => n + s.assets, 0),
        rescueAssetBytes: stamps.reduce((n, s) => n + s.assetBytes, 0),
        blocked: null,
        ...rest,
      };
    };

    const realOf = async (path: string) => NodeFSP.realpath(path).catch(() => "");
    const dirtyCache = new Map<string, number | null>();
    const SKIP_DIRTY_FIRST = new Set(["Library", ".npm", ".cache", ".gradle"]);
    /** Uncommitted git changes at or around `path`; 0 when it is outside any repository. */
    const uncommittedAt = async (path: string, boundary: string): Promise<number | null> => {
      const relative = NodePath.relative(boundary, path);
      if (SKIP_DIRTY_FIRST.has(relative.split(NodePath.sep)[0] ?? "")) return 0;
      let repo = (await exists(NodePath.join(path, ".git"))) ? path : "";
      for (let dir = NodePath.dirname(path); repo === "" && isInside(dir, boundary); dir = NodePath.dirname(dir)) {
        if (await exists(NodePath.join(dir, ".git"))) repo = dir;
      }
      if (repo === "") return 0;
      const key = `${repo}\0${path}`;
      if (dirtyCache.has(key)) return dirtyCache.get(key) ?? null;
      let count: number | null;
      if (repo === path) count = await gitDirtyCount(deps.git, repo);
      else {
        const result = await deps.git(repo, [
          "status",
          "--porcelain=v1",
          "-z",
          "--untracked-files=normal",
          "--",
          NodePath.relative(repo, path),
        ]);
        count = result && result.code === 0 ? result.stdout.split("\0").filter(Boolean).length : null;
      }
      dirtyCache.set(key, count);
      return count;
    };
    const cacheItem = (
      kind: "mole-section" | "dev-cache" | "agent-tmp",
      group: string,
      name: string,
      tool: string,
      key: string,
      stamps: Stamp[],
      allowedRoots: string[],
      detail: Record<string, string> = {},
    ) => {
      if (stamps.every((s) => s.bytes === 0 && s.files === 0)) return;
      add({
        item: base(kind, "safe", group, name, tool, stamps, { key, detail }),
        stamps,
        allowedRoots,
        repos: [],
      });
    };
    /** Pulls paths with uncommitted changes out of a 放心清 candidate set. */
    const splitUncommitted = async (stamps: Stamp[], boundary: string) => {
      const clean: Stamp[] = [];
      const dirty: Array<{ stamp: Stamp; files: number | null }> = [];
      for (const stamp of stamps) {
        const files = await uncommittedAt(stamp.path, boundary);
        if (files === 0) clean.push(stamp);
        else dirty.push({ stamp, files });
      }
      return { clean, dirty };
    };
    const dirtyBucket: Array<{ stamp: Stamp; files: number | null }> = [];

    try {
      const molePreview = deps.mole().catch(
        (error): Awaited<ReturnType<typeof previewWithMole>> => ({
          status: "failed",
          binary: "mo",
          message: String(error),
        }),
      );

      // 1. Developer caches this app already knows by name.
      step("devcache");
      const devCaches = await deps.devCaches().catch(() => []);
      const devPaths: string[] = [];
      for (const cache of devCaches) {
        const real = await realOf(cache.path);
        if (real !== cache.path || !isInside(real, roots.home)) continue;
        const { good } = await measureMany([real]);
        if (good.length === 0) continue;
        devPaths.push(real);
        cacheItem("dev-cache", "dev", cache.name, cache.name, `dev:${real}`, good, [roots.home]);
      }

      // 2. Agent worktrees.
      step("worktrees");
      const found: string[] = [];
      const walk = async (dir: string, depth: number) => {
        let names: string[];
        try {
          names = await NodeFSP.readdir(dir);
        } catch {
          return;
        }
        for (const name of names.toSorted()) {
          const path = NodePath.join(dir, name);
          const st = await NodeFSP.lstat(path).catch(() => null);
          if (!st || !st.isDirectory() || st.isSymbolicLink()) continue;
          const dotGit = await NodeFSP.lstat(NodePath.join(path, ".git")).catch(() => null);
          if (dotGit?.isFile()) found.push(path);
          else if (!dotGit && depth < 3) await walk(path, depth + 1);
        }
      };
      const worktreeRoots: string[] = [];
      for (const dir of await deps.worktreeDirs()) {
        const real = await realOf(dir);
        if (real !== "" && !worktreeRoots.includes(real)) worktreeRoots.push(real);
      }
      for (const dir of worktreeRoots) await walk(dir, 0);
      for (const worktree of found.slice(0, 200)) {
        if (deps.now() > deadline) {
          truncated = true;
          break;
        }
        const dirty = await gitDirtyCount(deps.git, worktree);
        const common = await deps.git(worktree, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
        const commonDir = common?.code === 0 ? common.stdout.trim() : "";
        const branch = (await deps.git(worktree, ["rev-parse", "--abbrev-ref", "HEAD"]))?.stdout.trim() ?? "";
        let merged: boolean | null = null;
        const head = await deps.git(worktree, ["rev-parse", "HEAD"]);
        if (head?.code === 0) {
          const origin = await deps.git(worktree, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
          const candidates = [
            ...(origin?.code === 0 ? [origin.stdout.trim()] : []),
            "origin/main",
            "origin/master",
            "main",
            "master",
          ];
          for (const candidate of candidates) {
            const verify = await deps.git(worktree, ["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`]);
            if (verify?.code !== 0) continue;
            const ancestor = await deps.git(worktree, ["merge-base", "--is-ancestor", "HEAD", candidate]);
            merged = ancestor?.code === 0;
            break;
          }
        }
        let measured: Stamp | null = null;
        let blockedCode: string | null = null;
        try {
          measured = toStamp(worktree, await measureTree(worktree, measureOptions(deadline, true)));
        } catch (error) {
          blockedCode = guardCode(error);
        }
        const commitTime = await deps.git(worktree, ["log", "-1", "--format=%ct"]);
        const committed = commitTime?.code === 0 ? Number(commitTime.stdout.trim()) * 1000 : 0;
        const lastUsedMs = Math.max(measured?.latest ?? 0, committed);
        const verdict = blockedCode
          ? { tier: "remind" as const, blocked: blockedCode }
          : classifyWorktree({ dirtyFiles: dirty, merged, lastUsedMs, nowMs: deps.now() });
        const stamps = measured ? [measured] : [];
        const repoName = commonDir ? NodePath.basename(NodePath.dirname(commonDir)) : "";
        add({
          item: base("worktree", verdict.tier, "worktrees", NodePath.basename(worktree), "t3-worktree", stamps, {
            key: `worktree:${worktree}`,
            detail: {
              repo: repoName,
              branch,
              merged: merged === null ? "unknown" : merged ? "yes" : "no",
              dirty: dirty === null ? "unknown" : String(dirty),
            },
            blocked: verdict.blocked,
            dirtyFiles: Math.max(0, dirty ?? 0),
            paths: [worktree],
            pathCount: 1,
            lastUsed: lastUsedMs > 0 ? iso(lastUsedMs) : null,
          }),
          stamps,
          allowedRoots: worktreeRoots,
          repos: [worktree],
          ...(commonDir ? { pruneGit: [commonDir] } : {}),
        });
      }

      // 3. AI session transcripts: suggest zip-and-archive, never touched silently.
      step("sessions");
      for (const [tool, root] of [
        ["codex", roots.codexSessions],
        ["claude-code", roots.claudeProjects],
      ] as const) {
        const rootStat = await NodeFSP.lstat(root).catch(() => null);
        if (!rootStat) continue;
        const real = await realOf(root);
        if (rootStat.isSymbolicLink() || real !== root || !rootStat.isDirectory()) {
          add({
            item: base("session-archive", "remind", "sessions", tool, tool, [], {
              key: `sessions:${tool}`,
              blocked: "linked-root",
              paths: [root],
              pathCount: 1,
            }),
            stamps: [],
            allowedRoots: [],
            repos: [],
          });
          continue;
        }
        const cutoff = deps.now() - SESSION_ARCHIVE_AFTER_DAYS * DAY_MS;
        const stamps: Stamp[] = [];
        let oldest = Infinity;
        const pending = [root];
        while (pending.length > 0 && stamps.length < MAX_SESSION_FILES && deps.now() < deadline) {
          const dir = pending.pop()!;
          for (const name of await NodeFSP.readdir(dir).catch(() => [] as string[])) {
            const path = NodePath.join(dir, name);
            const st = await NodeFSP.lstat(path).catch(() => null);
            if (!st || st.isSymbolicLink()) continue;
            if (st.isDirectory()) pending.push(path);
            else if (
              st.isFile() &&
              st.nlink === 1 &&
              st.dev === rootStat.dev &&
              (deps.uid === null || st.uid === deps.uid) &&
              /\.jsonl?$/.test(name) &&
              st.mtimeMs < cutoff &&
              !/[\n\0]/.test(path)
            ) {
              oldest = Math.min(oldest, st.mtimeMs);
              stamps.push({
                path,
                latest: st.mtimeMs,
                bytes: st.blocks * 512,
                files: 1,
                dev: st.dev,
                assets: 0,
                assetBytes: 0,
              });
            }
          }
        }
        if (stamps.length === 0) continue;
        add({
          item: base("session-archive", "review", "sessions", tool, tool, stamps, {
            key: `sessions:${tool}`,
            compress: true,
            paths: [root],
            pathCount: stamps.length,
            detail: {
              sessions: String(stamps.length),
              oldestDays: String(Math.floor((deps.now() - oldest) / DAY_MS)),
            },
          }),
          stamps,
          allowedRoots: [root],
          repos: [],
          archiveBase: root,
        });
      }

      // 4. Temporary folders agents leave in /tmp.
      step("tmp");
      const tmpReal = await realOf(roots.tmp);
      if (tmpReal !== "") {
        const candidates: string[] = [];
        for (const name of await NodeFSP.readdir(tmpReal).catch(() => [] as string[])) {
          if (isAgentTmpName(name)) candidates.push(NodePath.join(tmpReal, name));
        }
        const { good } = await measureMany(candidates);
        const idle = good.filter((s) => deps.now() - s.latest >= TMP_STALE_MS);
        const { clean, dirty } = await splitUncommitted(idle, tmpReal);
        dirtyBucket.push(...dirty);
        cacheItem("agent-tmp", "tmp", "tmp", "agents", "tmp", clean, [tmpReal], {
          count: String(clean.length),
        });
      }

      // 5. Old app copies, .bak-pre-*/.orig files and build generations (看一眼 only).
      step("backups");
      const settingsNow = await loadSettings();
      const buildDirectory = await effectiveBuildDirectory();
      const keep = settingsNow.keepNewest;
      const mtimeOf = async (path: string) => (await NodeFSP.lstat(path).catch(() => null))?.mtimeMs ?? 0;
      const reviewGroup = async (
        kind: "app-backup" | "backup-file" | "build-generation",
        familyKey: string,
        name: string,
        tool: string,
        paths: string[],
        allowedRoot: string,
        kept: number,
      ) => {
        const { good } = await measureMany(paths, true);
        const plain: Stamp[] = [];
        for (const stamp of good) {
          const files = (await exists(NodePath.join(stamp.path, ".git"))) ? await gitDirtyCount(deps.git, stamp.path) : 0;
          if (files === 0) plain.push(stamp);
          else {
            // Uncommitted work: its own row, rescued before anything is moved.
            add({
              item: base("dirty-repo", "review", "builds", NodePath.basename(stamp.path), tool, [stamp], {
                key: `dirty:${stamp.path}`,
                dirtyFiles: files ?? 0,
                paths: [stamp.path],
                pathCount: 1,
                detail: { family: name, unknown: files === null ? "yes" : "no" },
              }),
              stamps: [stamp],
              allowedRoots: [allowedRoot],
              repos: [stamp.path],
            });
          }
        }
        if (plain.length === 0) return;
        add({
          item: base(kind, "review", "builds", name, tool, plain, {
            key: `${kind}:${familyKey}`,
            detail: { count: String(plain.length), kept: String(kept) },
          }),
          stamps: plain,
          allowedRoots: [allowedRoot],
          repos: [],
        });
      };
      const grouped = async (
        directory: string,
        kind: "app-backup" | "build-generation",
        pick: (name: string) => string | null,
        onlyApps: boolean,
      ) => {
        const real = await realOf(directory);
        if (real === "") return;
        const entries: Array<{ name: string; path: string; mtime: number; family: string }> = [];
        for (const name of await NodeFSP.readdir(real).catch(() => [] as string[])) {
          const family = pick(name);
          if (family === null || (onlyApps && !name.endsWith(".app"))) continue;
          const path = NodePath.join(real, name);
          const st = await NodeFSP.lstat(path).catch(() => null);
          if (!st || st.isSymbolicLink() || !st.isDirectory()) continue;
          entries.push({ name, path, mtime: await mtimeOf(path), family });
        }
        const { kept, older } = splitKeepNewest(entries, {
          family: (e) => e.family,
          mtime: (e) => e.mtime,
          name: (e) => e.name,
          keep,
        });
        const byFamily = new Map<string, string[]>();
        for (const entry of older) byFamily.set(entry.family, [...(byFamily.get(entry.family) ?? []), entry.path]);
        for (const [family, paths] of byFamily) {
          const keptCount = kept.filter((e) => e.family === family).length;
          await reviewGroup(kind, `${real}:${family}`, family, kind === "app-backup" ? family : "build", paths, real, keptCount);
        }
      };
      await grouped(roots.applications, "app-backup", backupFamily, true);
      if (buildDirectory !== "") {
        await grouped(buildDirectory, "build-generation", buildFamily, false);
        await grouped(buildDirectory, "app-backup", backupFamily, false);
        // .bak-pre-* and .orig files, newest N per original file.
        const files: Array<{ name: string; path: string; mtime: number; family: string }> = [];
        const pendingDirs: Array<[string, number]> = [[buildDirectory, 0]];
        while (pendingDirs.length > 0 && files.length < 5000 && deps.now() < deadline) {
          const [dir, depth] = pendingDirs.pop()!;
          for (const name of await NodeFSP.readdir(dir).catch(() => [] as string[])) {
            if (name === "node_modules" || name === ".git") continue;
            const path = NodePath.join(dir, name);
            const st = await NodeFSP.lstat(path).catch(() => null);
            if (!st || st.isSymbolicLink()) continue;
            if (st.isDirectory()) {
              if (depth < 3) pendingDirs.push([path, depth + 1]);
              continue;
            }
            const family = backupFileFamily(name);
            if (st.isFile() && family !== null)
              files.push({ name, path, mtime: st.mtimeMs, family: NodePath.join(dir, family) });
          }
        }
        const { kept, older } = splitKeepNewest(files, {
          family: (e) => e.family,
          mtime: (e) => e.mtime,
          name: (e) => e.name,
          keep,
        });
        if (older.length > 0) {
          const { good } = await measureMany(older.map((e) => e.path));
          if (good.length > 0)
            add({
              item: base("backup-file", "review", "builds", ".bak-pre-* / .orig", "backup-files", good, {
                key: `backup-file:${buildDirectory}`,
                detail: { count: String(good.length), kept: String(kept.length) },
              }),
              stamps: good,
              allowedRoots: [buildDirectory],
              repos: [],
            });
        }
      }

      // 6. T3's own chat database and attachments: shown, never touched from here.
      step("t3data");
      const t3Stamps: Stamp[] = [];
      for (const path of roots.t3Data) {
        const real = await realOf(path);
        if (real === "") continue;
        const { good } = await measureMany([real]);
        t3Stamps.push(...good);
      }
      if (t3Stamps.length > 0)
        add({
          item: base("t3-data", "remind", "sessions", "t3", "t3", t3Stamps, {
            key: "t3-data",
            blocked: "protected-t3-data",
          }),
          stamps: [],
          allowedRoots: [],
          repos: [],
        });

      // 7. Mole's preview, mapped into 放心清 under this app's allowlist and guards.
      step("mole");
      const preview = await molePreview;
      let moleIgnored = 0;
      const moleBase = (): StorageTidyMole =>
        preview.status === "missing"
          ? { status: "missing", binary: null, message: null, listed: 0, ignored: 0 }
          : preview.status === "failed"
            ? { status: "failed", binary: preview.binary, message: preview.message, listed: 0, ignored: 0 }
            : {
                status: "found",
                binary: preview.binary,
                message: null,
                listed: new Set(preview.items.map((entry) => entry.path)).size,
                ignored: moleIgnored,
              };
      if (preview.status === "found") {
        const sectionOf = new Map<string, string>();
        for (const entry of preview.items) if (!sectionOf.has(entry.path)) sectionOf.set(entry.path, entry.section);
        const allowed = [...sectionOf.keys()].filter((path) => isMoleRemovable(path, roots.home));
        const outside = pruneNestedPaths(allowed).filter(
          (path) => !devPaths.some((dev) => path === dev || isInside(path, dev) || isInside(dev, path)),
        );
        const { good, skipped } = await measureMany(outside);
        moleIgnored = sectionOf.size - good.length - skipped.filter((s) => s.code === "scan-budget").length;
        const { clean, dirty } = await splitUncommitted(good, roots.home);
        dirtyBucket.push(...dirty);
        const bySection = new Map<string, Stamp[]>();
        for (const stamp of clean) {
          const key = moleSectionKey(sectionOf.get(stamp.path) ?? "");
          bySection.set(key, [...(bySection.get(key) ?? []), stamp]);
        }
        for (const [key, stamps] of bySection)
          cacheItem("mole-section", "mole", key, "mole", `mole:${key}`, stamps, [roots.home], {
            count: String(stamps.length),
          });
      }

      // Anything with uncommitted changes that a cache rule matched stays visible but untouched.
      if (dirtyBucket.length > 0) {
        const stamps = dirtyBucket.map((entry) => entry.stamp);
        add({
          item: base("dirty-repo", "remind", "protected", "uncommitted-caches", "git", stamps, {
            key: "dirty-caches",
            blocked: "dirty-worktree",
            dirtyFiles: dirtyBucket.reduce((n, entry) => n + (entry.files ?? 0), 0),
            detail: { count: String(stamps.length) },
          }),
          stamps: [],
          allowedRoots: [],
          repos: [],
        });
      }

      const order = { safe: 0, review: 1, remind: 2 } as const;
      items.sort((a, b) => order[a.tier] - order[b.tier] || b.bytes - a.bytes);
      scanResult = {
        scannedAt: iso(deps.now()),
        items,
        mole: moleBase(),
        truncated,
        buildDirectoryMissing: buildDirectory === "",
      };
    } finally {
      phase = "idle";
      progress = { checked: progress.total, total: progress.total, step: "done" };
    }
  };

  // ── rescue ────────────────────────────────────────────────────────────────
  const dirtyPatchFor = async (repo: string, directory: string, name: string) => {
    let patches = 0;
    let archives = 0;
    let bytes = 0;
    const files = await gitDirtyCount(deps.git, repo);
    if (!files) return { patches, archives, bytes, files: 0 };
    const diff = await deps.git(repo, ["diff", "--binary", "HEAD"], 120_000);
    if (!diff) throw new TidyGuardError("rescue-failed", "git diff failed");
    if (diff.stdout.length > 0) {
      const target = NodePath.join(directory, `${name}.patch`);
      await NodeFSP.writeFile(target, diff.stdout, { mode: 0o600 });
      patches++;
      bytes += Buffer.byteLength(diff.stdout);
    }
    const untracked = await deps.git(repo, ["ls-files", "--others", "--exclude-standard", "-z"], 120_000);
    if (!untracked) throw new TidyGuardError("rescue-failed", "git ls-files failed");
    if (untracked.stdout.length > 0) {
      const list = NodePath.join(directory, `${name}.untracked.list`);
      const archive = NodePath.join(directory, `${name}.untracked.tgz`);
      await NodeFSP.writeFile(list, untracked.stdout, { mode: 0o600 });
      const tar = await deps.tar(["-czf", archive, "--null", "-T", list], { cwd: repo });
      await NodeFSP.rm(list, { force: true });
      if (tar.code !== 0) throw new TidyGuardError("rescue-failed", "tar failed");
      archives++;
      bytes += (await NodeFSP.stat(archive)).size;
    }
    return { patches, archives, bytes, files };
  };
  const copyAssets = async (root: string, destination: string, budget: { left: number }) => {
    let copied = 0;
    let bytes = 0;
    const pending: Array<[string, string]> = [[root, ""]];
    while (pending.length > 0) {
      const [dir, relative] = pending.pop()!;
      for (const name of await NodeFSP.readdir(dir)) {
        if (name === "node_modules" || name === ".git") continue;
        const path = NodePath.join(dir, name);
        const rel = relative === "" ? name : NodePath.join(relative, name);
        const st = await NodeFSP.lstat(path);
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) {
          pending.push([path, rel]);
          continue;
        }
        if (!st.isFile() || !isRescueAsset(rel) || st.size > MAX_RESCUE_FILE_BYTES) continue;
        if (budget.left < st.size) continue;
        const target = NodePath.join(destination, rel);
        await NodeFSP.mkdir(NodePath.dirname(target), { recursive: true, mode: 0o700 });
        await NodeFSP.copyFile(path, target, NodeFSP.constants.COPYFILE_FICLONE);
        budget.left -= st.size;
        copied++;
        bytes += st.size;
      }
    }
    return { copied, bytes };
  };

  const execute = async (itemIds: ReadonlyArray<string>, rescue: boolean) => {
    if (phase !== "idle") throw new TidyGuardError("busy");
    if (!scanResult) throw new TidyGuardError("scan-required");
    phase = "executing";
    const startedAt = deps.now();
    const opId = `op-${startedAt.toString(36)}-${NodeCrypto.randomBytes(3).toString("hex")}`;
    const ids = [...new Set(itemIds)];
    const selected = ids.map((id) => stored.get(id));
    const useRescue = rescue;
    const entries: StorageTidyOutcome[] = [];
    const moves: Manifest["moves"] = [];
    const batches: string[] = [];
    let deletedBytes = 0;
    let trashedBytes = 0;
    let writtenBytes = 0;
    let rescueSummary: StorageTidyRescue | null = null;
    // Pick the volume that holds the most bytes: the headline accounting is for that disk.
    const devBytes = new Map<number, number>();
    for (const entry of selected)
      for (const s of entry?.stamps ?? []) devBytes.set(s.dev, (devBytes.get(s.dev) ?? 0) + s.bytes);
    const primaryDev = [...devBytes].toSorted((a, b) => b[1] - a[1])[0]?.[0];
    volumeCache = undefined;
    const volume = await volumeFor(primaryDev).catch(() => undefined);
    const before = volume?.freeBytes ?? null;
    current = {
      operation: {
        id: opId,
        startedAt: iso(startedAt),
        finishedAt: null,
        phase: "running",
        volumePath: volume?.path ?? roots.home,
        deletedBytes: 0,
        trashedBytes: 0,
        writtenBytes: 0,
        freeBefore: before,
        freeAfter: null,
        totalBytes: volume?.totalBytes ?? null,
        recoverableUntil: null,
        undone: false,
        purged: false,
        rescue: null,
        entries: [],
        error: null,
        progress: { done: 0, total: selected.length },
      },
      moves,
      batches,
    };
    try {
      const rescueDirectory = NodePath.join(roots.rescueRoot, localDateStamp(startedAt));
      let rescueDirReady = false;
      const ensureRescueDirectory = async () => {
        if (rescueDirReady) return rescueDirectory;
        await NodeFSP.mkdir(rescueDirectory, { recursive: true, mode: 0o700 });
        rescueDirReady = true;
        return rescueDirectory;
      };
      const rescueStats = { assets: 0, patches: 0, archives: 0, sessionArchives: 0, bytes: 0, repos: [] as Array<{ name: string; files: number }> };
      const assetBudget = { left: MAX_RESCUE_TOTAL_BYTES };
      const trashBatches = new Map<string, string>();
      const batchFor = async (path: string) => {
        const trash = await trashDirectoryFor(path, roots.home, deps.uid);
        let batch = trashBatches.get(trash);
        if (!batch) {
          batch = NodePath.join(trash, trashBatchName(opId));
          await NodeFSP.mkdir(batch, { mode: 0o700 });
          trashBatches.set(trash, batch);
          batches.push(batch);
        }
        return batch;
      };

      for (const [index, entry] of selected.entries()) {
        const requestedId = ids[index] ?? "";
        const progressNow = { done: index, total: selected.length };
        current.operation = { ...current.operation, progress: progressNow };
        if (!entry) {
          entries.push({ itemId: requestedId, kind: "dirty-repo", tier: "remind", name: "", outcome: "skipped", bytes: 0, reason: "unknown-item" });
          continue;
        }
        const { item } = entry;
        const outcome = (
          kind: StorageTidyOutcome["outcome"],
          bytes: number,
          reason: string | null,
        ): StorageTidyOutcome => ({ itemId: item.id, kind: item.kind, tier: item.tier, name: item.name, outcome: kind, bytes, reason });
        if (item.tier === "remind" || item.disposal === "none") {
          entries.push(outcome("skipped", 0, item.blocked ?? "reminder-only"));
          continue;
        }
        const needsRescue = item.kind !== "dev-cache" && item.kind !== "mole-section" && item.kind !== "agent-tmp" && item.kind !== "session-archive";
        if (needsRescue && item.dirtyFiles > 0 && !useRescue) {
          entries.push(outcome("skipped", 0, "uncommitted-needs-rescue"));
          continue;
        }
        const writeEstimate = (needsRescue && useRescue ? item.rescueAssetBytes + 64 * 1024 ** 2 : 0) + (item.compress ? item.bytes : 0);
        if (writeEstimate > 0) {
          const free = await (deps.freeBytes ?? defaultFreeBytes)(roots.home).catch(() => 0);
          if (free - writeEstimate < MIN_FREE_AFTER_WRITE_BYTES) {
            entries.push(outcome("skipped", 0, "low-disk"));
            continue;
          }
        }
        try {
          if (needsRescue && useRescue) {
            const directory = NodePath.join(await ensureRescueDirectory(), "组件素材归档", `${slug(item.name)}-${index + 1}`);
            await NodeFSP.mkdir(directory, { recursive: true, mode: 0o700 });
            for (const stamp of entry.stamps) {
              const copied = await copyAssets(stamp.path, NodePath.join(directory, slug(NodePath.basename(stamp.path))), assetBudget);
              rescueStats.assets += copied.copied;
              rescueStats.bytes += copied.bytes;
            }
            for (const repo of entry.repos) {
              const patchDirectory = NodePath.join(await ensureRescueDirectory(), "未提交改动");
              await NodeFSP.mkdir(patchDirectory, { recursive: true, mode: 0o700 });
              const saved = await dirtyPatchFor(repo, patchDirectory, `${slug(NodePath.basename(repo))}-${index + 1}`);
              rescueStats.patches += saved.patches;
              rescueStats.archives += saved.archives;
              rescueStats.bytes += saved.bytes;
              if (saved.files > 0) rescueStats.repos.push({ name: NodePath.basename(repo), files: saved.files });
            }
          }
          if (item.compress && entry.archiveBase) {
            const directory = NodePath.join(await ensureRescueDirectory(), "会话归档");
            await NodeFSP.mkdir(directory, { recursive: true, mode: 0o700 });
            const archive = NodePath.join(directory, `${slug(item.tool)}-sessions-${localDateStamp(startedAt)}.tar.gz`);
            const list = `${archive}.list`;
            const relatives = entry.stamps.map((s) => NodePath.relative(entry.archiveBase!, s.path));
            await NodeFSP.writeFile(list, relatives.join("\0"), { mode: 0o600 });
            const made = await deps.tar(["-czf", archive, "--null", "-T", list], { cwd: entry.archiveBase });
            await NodeFSP.rm(list, { force: true });
            if (made.code !== 0) throw new TidyGuardError("archive-failed");
            const listing = await deps.tar(["-tzf", archive]);
            const members = listing.stdout.split("\n").filter((line) => line !== "" && !line.endsWith("/")).length;
            if (listing.code !== 0 || members !== relatives.length) {
              await NodeFSP.rm(archive, { force: true });
              throw new TidyGuardError("archive-unverified");
            }
            const archiveBytes = (await NodeFSP.stat(archive)).size;
            writtenBytes += archiveBytes;
            rescueStats.sessionArchives++;
          }
          let done = 0;
          let doneBytes = 0;
          let failure: string | null = null;
          for (const stamp of entry.stamps) {
            try {
              const measured = await verifyForRemoval(stamp.path, stamp, entry.allowedRoots, measureOptions(deps.now() + 30_000));
              if (item.kind === "mole-section" && !isMoleRemovable(stamp.path, roots.home))
                throw new TidyGuardError("outside-allowed-roots");
              if (item.disposal === "delete") {
                await NodeFSP.rm(stamp.path, { recursive: true });
              } else {
                const batch = await batchFor(stamp.path);
                const target = NodePath.join(batch, `${String(moves.length + 1).padStart(4, "0")}-${slug(NodePath.basename(stamp.path))}`);
                await NodeFSP.rename(stamp.path, target);
                moves.push({ original: stamp.path, trashed: target, bytes: measured.bytes });
              }
              done++;
              if (stamp.dev === primaryDev || primaryDev === undefined) doneBytes += measured.bytes;
            } catch (error) {
              failure ??= guardCode(error);
            }
          }
          if (item.disposal === "delete") deletedBytes += doneBytes;
          else trashedBytes += doneBytes;
          if (item.disposal === "delete" && done > 0)
            for (const git of entry.pruneGit ?? []) await deps.git(NodePath.dirname(git), ["--git-dir", git, "worktree", "prune"]).catch(() => null);
          entries.push(
            done === 0
              ? outcome("failed", 0, failure)
              : outcome(item.disposal === "delete" ? "deleted" : "trashed", doneBytes, failure === null ? null : `partial:${failure}`),
          );
        } catch (error) {
          entries.push(outcome("failed", 0, guardCode(error)));
        }
        current.operation = { ...current.operation, entries: [...entries], deletedBytes, trashedBytes, writtenBytes: writtenBytes + rescueStats.bytes };
      }
      writtenBytes += rescueStats.bytes;
      if (rescueDirReady)
        rescueSummary = {
          directory: rescueDirectory,
          assets: rescueStats.assets,
          patches: rescueStats.patches,
          untrackedArchives: rescueStats.archives,
          sessionArchives: rescueStats.sessionArchives,
          bytes: writtenBytes,
          dirtyRepos: rescueStats.repos,
        };
      volumeCache = undefined;
      const after = (await volumeFor(primaryDev).catch(() => undefined))?.freeBytes ?? null;
      const finished = deps.now();
      const trashedAny = moves.length > 0;
      const manifest: Manifest = {
        operation: {
          ...current.operation,
          finishedAt: iso(finished),
          phase: "completed",
          deletedBytes,
          trashedBytes,
          writtenBytes,
          freeAfter: after,
          recoverableUntil: trashedAny ? recoverableUntil(finished) : null,
          rescue: rescueSummary,
          entries,
          progress: null,
        },
        moves,
        batches,
      };
      current = manifest;
      await writeManifest(manifest);
    } catch (error) {
      const manifest: Manifest = {
        operation: { ...current.operation, phase: "failed", finishedAt: iso(deps.now()), error: guardCode(error), entries, progress: null },
        moves,
        batches,
      };
      current = manifest;
      await writeManifest(manifest).catch(() => undefined);
    } finally {
      stored = new Map();
      scanResult = null;
      phase = "idle";
    }
  };

  // ── undo ──────────────────────────────────────────────────────────────────
  /** Puts items back from this app's own Trash batch while they are still there. */
  const undo = async (operationId: string) => {
    if (phase !== "idle") throw new TidyGuardError("busy");
    const manifest = await readManifest(operationId);
    if (!manifest) throw new TidyGuardError("operation-missing");
    const { operation } = manifest;
    if (operation.undone || operation.purged) throw new TidyGuardError("not-recoverable");
    phase = "executing";
    try {
      let restored = 0;
      for (const move of manifest.moves.toReversed()) {
        const parent = NodePath.dirname(move.original);
        const inTrash = await NodeFSP.lstat(move.trashed).catch(() => null);
        const parentOk = await NodeFSP.lstat(parent).then((st) => st.isDirectory(), () => false);
        if (!inTrash || inTrash.isSymbolicLink() || !parentOk || (await exists(move.original))) continue;
        await NodeFSP.rename(move.trashed, move.original);
        restored++;
      }
      for (const batch of manifest.batches) {
        const left = await NodeFSP.readdir(batch).catch(() => ["?"]);
        if (left.length === 0 && NodePath.basename(batch).startsWith(TRASH_BATCH_PREFIX))
          await NodeFSP.rmdir(batch).catch(() => undefined);
      }
      const updated: Manifest = {
        ...manifest,
        operation: {
          ...operation,
          undone: true,
          recoverableUntil: null,
          entries: operation.entries.map((e) => (e.outcome === "trashed" ? { ...e, reason: "restored" } : e)),
        },
      };
      if (restored === 0 && manifest.moves.length > 0) throw new TidyGuardError("nothing-restored");
      await writeManifest(updated);
      if (current?.operation.id === operationId) current = updated;
    } finally {
      phase = "idle";
    }
  };

  const openArchive = async (operationId: string) => {
    const manifest = await readManifest(operationId);
    const directory = manifest?.operation.rescue?.directory;
    if (!directory || !isInside(directory, roots.rescueRoot)) throw new TidyGuardError("archive-missing");
    const st = await NodeFSP.lstat(directory).catch(() => null);
    if (!st?.isDirectory() || st.isSymbolicLink()) throw new TidyGuardError("archive-missing");
    await deps.openPath(directory);
  };

  const state = async (): Promise<StorageTidyState> => {
    await purgeExpired().catch(() => undefined);
    const latest = await latestManifest();
    const rescueItems = (scanResult?.items ?? []).filter((item) => item.tier === "review" && item.kind !== "session-archive");
    return {
      settings: await loadSettings(),
      volumes: [...(await volumes())],
      phase,
      progress,
      scan: scanResult,
      operation: latest?.operation ?? null,
      rescueRoot:
        NodePath.isAbsolute(roots.rescueRoot) && isInside(roots.rescueRoot, roots.home)
          ? `~/${NodePath.relative(roots.home, roots.rescueRoot)}`
          : roots.rescueRoot,
      rescuePreview: scanResult
        ? {
            assets: rescueItems.reduce((n, item) => n + item.rescueAssets, 0),
            assetBytes: rescueItems.reduce((n, item) => n + item.rescueAssetBytes, 0),
            dirtyRepos: rescueItems
              .filter((item) => item.dirtyFiles > 0)
              .map((item) => ({ name: item.name, files: item.dirtyFiles })),
          }
        : null,
    };
  };

  return { state, scan, execute, undo, saveSettings, openArchive, purgeExpired, effectiveBuildDirectory };
}
export type StorageTidyEngine = ReturnType<typeof createStorageTidyEngine>;
