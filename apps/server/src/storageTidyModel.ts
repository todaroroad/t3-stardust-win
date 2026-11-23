// @effect-diagnostics nodeBuiltinImport:off globalDate:off - pure path and date arithmetic.
// Pure decision rules for 存储与清理: which tier something belongs to, and what this app will
// refuse to delete no matter what a cleaner program or the page asks. No filesystem access here.
import * as NodePath from "node:path";

import type { StorageTidyTier } from "@t3tools/contracts";

export const DAY_MS = 86_400_000;
/** Items moved to Trash stay recoverable, and occupy disk, for this long. */
export const RECOVERY_DAYS = 7;
export const SESSION_ARCHIVE_AFTER_DAYS = 60;
export const WORKTREE_RECENT_DAYS = 3;
export const TMP_STALE_MS = 24 * 3_600_000;
/** A write this recent means something is probably using the path right now. */
export const IN_USE_WINDOW_MS = 10 * 60_000;

const inside = (child: string, parent: string) => {
  const relative = NodePath.relative(parent, child);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + NodePath.sep) &&
    !NodePath.isAbsolute(relative)
  );
};

// Directory names that only ever hold data a program rebuilds on demand.
const LIBRARY_CACHE_SEGMENTS: ReadonlySet<string> = new Set([
  "Cache",
  "Caches",
  "Cache_Data",
  "Code Cache",
  "GPUCache",
  "ShaderCache",
  "DawnCache",
  "GrShaderCache",
  "GraphiteDawnCache",
  "crx_cache",
  "CacheStorage",
]);
const HOME_CACHE_PREFIXES: ReadonlyArray<string> = [
  "Library/Caches",
  "Library/Logs",
  ".cache",
  ".npm/_cacache",
  ".npm/_npx",
  ".npm/_logs",
  ".gradle/caches",
  "Library/Developer/Xcode/DerivedData",
];

/**
 * This app's own allowlist for what a Mole preview may add to 放心清. Mole's list also names
 * documents, project folders and application data; none of that is ever deleted from here.
 */
export function isMoleRemovable(path: string, home: string): boolean {
  if (!NodePath.isAbsolute(path) || NodePath.normalize(path) !== path) return false;
  if (!inside(path, home)) return false;
  const relative = NodePath.relative(home, path);
  const segments = relative.split(NodePath.sep);
  // The cache roots themselves are never removed, only what is inside them.
  if (HOME_CACHE_PREFIXES.includes(relative)) return false;
  for (const prefix of HOME_CACHE_PREFIXES) {
    if (relative.startsWith(prefix + NodePath.sep)) return true;
  }
  if (segments.includes("__pycache__")) return true;
  const next = segments.indexOf(".next");
  if (next >= 0 && segments[next + 1] === "cache") return true;
  const nodeModules = segments.indexOf("node_modules");
  if (nodeModules >= 0 && segments[nodeModules + 1] === ".cache") return true;
  if (segments[0] === "Library") {
    // Group Containers/<id>/Library/Caches/…, Application Support/<app>/…/Cache/…
    const rest = segments.slice(2);
    if (rest.some((segment) => LIBRARY_CACHE_SEGMENTS.has(segment))) return true;
    if (segments[1] === "Application Support" && /\.log\.old$/.test(NodePath.basename(path)))
      return true;
  }
  return false;
}

/** Keeps only the outermost path of any nested pair, so nothing is measured or deleted twice. */
export function pruneNestedPaths(paths: ReadonlyArray<string>): string[] {
  const unique = [...new Set(paths)].toSorted((a, b) => a.length - b.length);
  const kept: string[] = [];
  for (const path of unique) {
    if (!kept.some((parent) => path === parent || inside(path, parent))) kept.push(path);
  }
  return kept;
}

const MOLE_SECTION_KEYS: Readonly<Record<string, string>> = {
  "user essentials": "user",
  "app caches": "apps",
  browsers: "browsers",
  "developer tools": "developer",
  "apps & utilities": "utilities",
  "application support": "support",
};
export const moleSectionKey = (section: string) =>
  MOLE_SECTION_KEYS[section.trim().toLowerCase()] ?? "other";

export function classifyWorktree(input: {
  readonly dirtyFiles: number | null;
  readonly merged: boolean | null;
  readonly lastUsedMs: number;
  readonly nowMs: number;
}): { readonly tier: StorageTidyTier; readonly blocked: string | null } {
  if (input.dirtyFiles === null) return { tier: "remind", blocked: "git-unreadable" };
  if (input.dirtyFiles > 0) return { tier: "remind", blocked: "dirty-worktree" };
  const idleDays = (input.nowMs - input.lastUsedMs) / DAY_MS;
  if (input.merged === true && idleDays >= WORKTREE_RECENT_DAYS)
    return { tier: "safe", blocked: null };
  return { tier: "review", blocked: null };
}

/** `T3 Code (Alpha).before-C98.app` → `T3 Code (Alpha)`; null when the name is not a backup copy. */
export function backupFamily(name: string): string | null {
  const match = name.match(/^(.*?)(?:^|[\s._()-])(?:backup|before|rollback)(?=$|[\s._()-])/i);
  const family = match?.[1]?.trim() ?? "";
  return family === "" ? null : family;
}
/** `config.json.bak-pre-c97` and `schema.sql.orig` → their base names. */
export function backupFileFamily(name: string): string | null {
  const match = name.match(/^(.+?)\.(?:bak-pre-.+|orig)$/);
  return match?.[1] ?? null;
}
/** Folders such as `c97-build`, `c104-build`: the digits are the generation. */
export function buildFamily(name: string): string | null {
  return /\d/.test(name) ? name.replace(/\d+/g, "#") : null;
}

export function splitKeepNewest<T>(
  entries: ReadonlyArray<T>,
  options: {
    readonly family: (entry: T) => string;
    readonly mtime: (entry: T) => number;
    readonly name: (entry: T) => string;
    readonly keep: number;
  },
): { readonly kept: T[]; readonly older: T[] } {
  const families = new Map<string, T[]>();
  for (const entry of entries) {
    const key = options.family(entry);
    families.set(key, [...(families.get(key) ?? []), entry]);
  }
  const kept: T[] = [];
  const older: T[] = [];
  for (const group of families.values()) {
    const sorted = group.toSorted(
      (a, b) => options.mtime(b) - options.mtime(a) || options.name(b).localeCompare(options.name(a)),
    );
    kept.push(...sorted.slice(0, options.keep));
    older.push(...sorted.slice(options.keep));
  }
  return { kept, older };
}

const AGENT_TMP_NAME =
  /^(?:t3[-_a-z0-9.]*|codex[-_a-z0-9.]*|claude[-_a-z0-9.]*|agent[-_a-z0-9.]*|playwright[_-][a-z0-9_-]*|puppeteer[_-][a-z0-9_-]*|mcp[-_a-z0-9.]*)$/i;
export const isAgentTmpName = (name: string) => AGENT_TMP_NAME.test(name);

export const RESCUE_ASSET_EXTENSIONS: ReadonlySet<string> = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".mp4",
  ".svg",
  ".css",
  ".html",
  ".tsx",
]);
/** Visual assets, stylesheets and component sources; never anything inside node_modules or .git. */
export function isRescueAsset(relativePath: string): boolean {
  const segments = relativePath.split(NodePath.sep);
  if (segments.includes("node_modules") || segments.includes(".git")) return false;
  return RESCUE_ASSET_EXTENSIONS.has(NodePath.extname(relativePath).toLowerCase());
}

export const TRASH_BATCH_PREFIX = "T3 Stardust ";
export const trashBatchName = (operationId: string) => `${TRASH_BATCH_PREFIX}${operationId}`;

export const recoverableUntil = (nowMs: number) =>
  new Date(nowMs + RECOVERY_DAYS * DAY_MS).toISOString();

/** `YYYY-MM-DD` in local time, for the rescue folder name. */
export function localDateStamp(nowMs: number): string {
  const date = new Date(nowMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
