import type {
  StorageTidyItem,
  StorageTidyOperation,
  StorageTidyScan,
  StorageTidyState,
} from "@t3tools/contracts";

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const NOW = Date.parse("2026-11-22T06:08:00.000Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const item = (over: Partial<StorageTidyItem> & Pick<StorageTidyItem, "id" | "kind" | "tier" | "name">): StorageTidyItem => ({
  group: "",
  tool: "",
  detail: {},
  lastUsed: ago(30),
  bytes: GB,
  fileCount: 100,
  paths: [],
  pathCount: 1,
  disposal: over.tier === "safe" ? "delete" : over.tier === "review" ? "trash" : "none",
  compress: false,
  dirtyFiles: 0,
  rescueAssets: 0,
  rescueAssetBytes: 0,
  blocked: null,
  ...over,
});

export const TIDY_FIXTURE_NOW = NOW;

export const fixtureItems: ReadonlyArray<StorageTidyItem> = [
  item({ id: "mole-developer", kind: "mole-section", tier: "safe", group: "mole", name: "developer", tool: "mole", bytes: 14.2 * GB, fileCount: 61_204, pathCount: 88, paths: ["/Users/me/.npm/_cacache/content-v2", "/Users/me/Projects/scraper/__pycache__", "/Users/me/Projects/web-app/.next/cache/swc"], lastUsed: ago(2) }),
  item({ id: "mole-browsers", kind: "mole-section", tier: "safe", group: "mole", name: "browsers", tool: "mole", bytes: 8.1 * GB, fileCount: 12_033, pathCount: 31, paths: ["/Users/me/Library/Caches/Google/Chrome/Default/Cache"], lastUsed: ago(1) }),
  item({ id: "mole-user", kind: "mole-section", tier: "safe", group: "mole", name: "user", tool: "mole", bytes: 6.3 * GB, fileCount: 9_410, pathCount: 52, paths: ["/Users/me/Library/Caches/@deepseek-aidsh-desktop-updater", "/Users/me/Library/Caches/GeoServices"], lastUsed: ago(4) }),
  item({ id: "mole-support", kind: "mole-section", tier: "safe", group: "mole", name: "support", tool: "mole", bytes: 3.0 * GB, fileCount: 4_200, pathCount: 61, paths: ["/Users/me/Library/Application Support/Code/Cache/Cache_Data"], lastUsed: ago(6) }),
  item({ id: "dev-xcode", kind: "dev-cache", tier: "safe", group: "dev", name: "Xcode DerivedData", tool: "Xcode DerivedData", bytes: 9.7 * GB, fileCount: 88_000, paths: ["/Users/me/Library/Developer/Xcode/DerivedData"], lastUsed: ago(12) }),
  item({ id: "dev-npm", kind: "dev-cache", tier: "safe", group: "dev", name: "npm 下载缓存", tool: "npm 下载缓存", bytes: 4.1 * GB, fileCount: 52_000, paths: ["/Users/me/.npm/_cacache"], lastUsed: ago(3) }),
  item({ id: "wt-port", kind: "worktree", tier: "safe", group: "worktrees", name: "c97-port", tool: "t3-worktree", bytes: 3.2 * GB, fileCount: 41_900, detail: { repo: "t3code", branch: "stardust/c97", merged: "yes", dirty: "0" }, paths: ["/Users/me/.t3/worktrees/t3code/c97-port"], rescueAssets: 118, rescueAssetBytes: 14 * MB, lastUsed: ago(21) }),
  item({ id: "wt-build", kind: "worktree", tier: "safe", group: "worktrees", name: "c99-build", tool: "t3-worktree", bytes: 2.6 * GB, fileCount: 39_000, detail: { repo: "t3code", branch: "stardust/c99", merged: "yes", dirty: "0" }, paths: ["/Users/me/.t3/worktrees/t3code/c99-build"], rescueAssets: 94, rescueAssetBytes: 9 * MB, lastUsed: ago(17) }),
  item({ id: "tmp-agents", kind: "agent-tmp", tier: "safe", group: "tmp", name: "tmp", tool: "agents", bytes: 1.9 * GB, fileCount: 3_100, detail: { count: "14" }, pathCount: 14, paths: ["/private/tmp/codex-7f3a", "/private/tmp/playwright_chromiumdev_profile-x9"], lastUsed: ago(3) }),

  item({ id: "sess-codex", kind: "session-archive", tier: "review", group: "sessions", name: "codex", tool: "codex", bytes: 3.4 * GB, fileCount: 412, compress: true, detail: { sessions: "412", oldestDays: "214" }, pathCount: 412, paths: ["/Users/me/.codex/sessions"], lastUsed: ago(214) }),
  item({ id: "sess-claude", kind: "session-archive", tier: "review", group: "sessions", name: "claude-code", tool: "claude-code", bytes: 2.3 * GB, fileCount: 268, compress: true, detail: { sessions: "268", oldestDays: "301" }, pathCount: 268, paths: ["/Users/me/.claude/projects"], lastUsed: ago(301) }),
  item({ id: "build-gen", kind: "build-generation", tier: "review", group: "builds", name: "c#-build", tool: "build", bytes: 9.8 * GB, fileCount: 120_000, detail: { count: "8", kept: "2" }, pathCount: 8, paths: ["/Volumes/External/builds/c97-build", "/Volumes/External/builds/c98-build"], rescueAssets: 612, rescueAssetBytes: 41 * MB, lastUsed: ago(40) }),
  item({ id: "build-dirty", kind: "dirty-repo", tier: "review", group: "builds", name: "c72-port", tool: "build", bytes: 4.1 * GB, fileCount: 52_000, dirtyFiles: 794, detail: { family: "c#-port", unknown: "no" }, paths: ["/Volumes/External/builds/c72-port"], rescueAssets: 408, rescueAssetBytes: 17 * MB, lastUsed: ago(73) }),
  item({ id: "app-backup", kind: "app-backup", tier: "review", group: "builds", name: "T3 Code (Alpha)", tool: "T3 Code (Alpha)", bytes: 7.2 * GB, fileCount: 31_000, detail: { count: "6", kept: "2" }, pathCount: 6, paths: ["/Applications/T3 Code (Alpha).before-C98.app"], lastUsed: ago(33) }),
  item({ id: "bak-files", kind: "backup-file", tier: "review", group: "builds", name: ".bak-pre-* / .orig", tool: "backup-files", bytes: 2.1 * GB, fileCount: 47, detail: { count: "47", kept: "2" }, pathCount: 47, paths: ["/Volumes/External/builds/c97-build/app.asar.bak-pre-c97"], lastUsed: ago(50) }),
  item({ id: "wt-unmerged", kind: "worktree", tier: "review", group: "worktrees", name: "usage-disk-chip", tool: "t3-worktree", bytes: 1.4 * GB, fileCount: 22_000, detail: { repo: "t3code", branch: "feat/usage-disk-chip", merged: "no", dirty: "0" }, paths: ["/Users/me/.t3/worktrees/t3code/usage-disk-chip"], rescueAssets: 22, rescueAssetBytes: 2 * MB, lastUsed: ago(9) }),

  item({ id: "wt-dirty", kind: "worktree", tier: "remind", group: "worktrees", name: "wip-cleanup", tool: "t3-worktree", bytes: 2.2 * GB, fileCount: 30_000, dirtyFiles: 12, blocked: "dirty-worktree", detail: { repo: "t3code", branch: "wip/cleanup", merged: "no", dirty: "12" }, paths: ["/Users/me/.t3/worktrees/t3code/wip-cleanup"], lastUsed: ago(1) }),
  item({ id: "t3-data", kind: "t3-data", tier: "remind", group: "sessions", name: "t3", tool: "t3", bytes: 5.9 * GB, fileCount: 18_000, blocked: "protected-t3-data", paths: ["/Users/me/.t3/userdata/state.sqlite"], lastUsed: ago(0) }),
];

export const fixtureScan: StorageTidyScan = {
  scannedAt: "2026-11-22T06:07:30.000Z",
  items: fixtureItems,
  mole: { status: "found", binary: "/Users/me/.local/bin/mo", message: null, listed: 383, ignored: 107 },
  truncated: false,
  buildDirectoryMissing: false,
};

export const fixtureOperation: StorageTidyOperation = {
  id: "op-demo",
  startedAt: "2026-11-22T06:08:10.000Z",
  finishedAt: "2026-11-22T06:08:52.000Z",
  phase: "completed",
  volumePath: "/",
  deletedBytes: 55.2 * GB,
  trashedBytes: 17.0 * GB,
  writtenBytes: 168 * MB,
  freeBefore: 40 * GB,
  freeAfter: 95.0 * GB,
  totalBytes: 500 * GB,
  recoverableUntil: "2026-11-29T06:08:52.000Z",
  undone: false,
  purged: false,
  rescue: {
    directory: "/Users/me/Documents/T3 Stardust 抢救/2026-11-22",
    assets: 1020,
    patches: 1,
    untrackedArchives: 1,
    sessionArchives: 2,
    bytes: 168 * MB,
    dirtyRepos: [{ name: "c72-port", files: 794 }],
  },
  entries: [
    { itemId: "mole-developer", kind: "mole-section", tier: "safe", name: "developer", outcome: "deleted", bytes: 14.2 * GB, reason: null },
    { itemId: "dev-xcode", kind: "dev-cache", tier: "safe", name: "Xcode DerivedData", outcome: "deleted", bytes: 9.7 * GB, reason: null },
    { itemId: "wt-port", kind: "worktree", tier: "safe", name: "c97-port", outcome: "deleted", bytes: 3.2 * GB, reason: null },
    { itemId: "sess-codex", kind: "session-archive", tier: "review", name: "codex", outcome: "trashed", bytes: 3.4 * GB, reason: null },
    { itemId: "build-gen", kind: "build-generation", tier: "review", name: "c#-build", outcome: "trashed", bytes: 9.8 * GB, reason: null },
    { itemId: "mole-browsers", kind: "mole-section", tier: "safe", name: "browsers", outcome: "deleted", bytes: 0, reason: "partial:in-use" },
    { itemId: "wt-dirty", kind: "worktree", tier: "remind", name: "wip-cleanup", outcome: "skipped", bytes: 0, reason: "dirty-worktree" },
  ],
  error: null,
  progress: null,
};

export const fixtureState: StorageTidyState = {
  settings: { buildDirectory: "/Volumes/External/builds", keepNewest: 2, rescueFirst: true },
  volumes: [
    { id: "1", name: "Macintosh HD", path: "/", totalBytes: 500 * GB, freeBytes: 40 * GB, internal: true },
    { id: "2", name: "External", path: "/Volumes/External", totalBytes: 1000 * GB, freeBytes: 12 * GB, internal: false },
  ],
  phase: "idle",
  progress: { checked: 0, total: 8, step: "" },
  scan: null,
  operation: null,
  rescueRoot: "~/Documents/T3 Stardust 抢救",
  rescuePreview: null,
};

export const fixtureResultState: StorageTidyState = {
  ...fixtureState,
  scan: fixtureScan,
  rescuePreview: {
    assets: 1254,
    assetBytes: 84 * MB,
    dirtyRepos: [{ name: "c72-port", files: 794 }],
  },
};
