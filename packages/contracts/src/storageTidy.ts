import * as Schema from "effect/Schema";

// "存储与清理": a scan that sorts removable things into three tiers, then an executor that only
// ever acts on item ids the server itself produced. The client never sends a path or a command.

/** 放心清 = rebuildable, deleted at once. 看一眼 = moved to Trash, undoable. 只提醒不动 = never touched. */
export const StorageTidyTier = Schema.Literals(["safe", "review", "remind"]);
export type StorageTidyTier = typeof StorageTidyTier.Type;

export const StorageTidyKind = Schema.Literals([
  "mole-section",
  "dev-cache",
  "worktree",
  "agent-tmp",
  "session-archive",
  "t3-data",
  "app-backup",
  "backup-file",
  "build-generation",
  "dirty-repo",
]);
export type StorageTidyKind = typeof StorageTidyKind.Type;

export const StorageTidyItem = Schema.Struct({
  id: Schema.String,
  tier: StorageTidyTier,
  kind: StorageTidyKind,
  /** Grouping key inside a tier, e.g. "mole", "worktrees", "sessions". */
  group: Schema.String,
  /** Raw, untranslated name: a worktree branch, a tool, a Mole section, a family of app copies. */
  name: Schema.String,
  /** Tool or program that produced the data; the page translates known ids. */
  tool: Schema.String,
  /** Short facts the page interpolates into its own sentences (counts, repo names, …). */
  detail: Schema.Record(Schema.String, Schema.String),
  lastUsed: Schema.NullOr(Schema.String),
  bytes: Schema.Number,
  fileCount: Schema.Number,
  /** Up to eight example paths; the full list stays on the server. */
  paths: Schema.Array(Schema.String),
  pathCount: Schema.Number,
  disposal: Schema.Literals(["delete", "trash", "none"]),
  /** Transcripts are zipped into an archive first, then the originals go to Trash. */
  compress: Schema.Boolean,
  /** Uncommitted git changes that "先抢救" would save before this item is removed. */
  dirtyFiles: Schema.Number,
  /** Visual assets that "先抢救" would copy out first. */
  rescueAssets: Schema.Number,
  rescueAssetBytes: Schema.Number,
  /** Why the page cannot offer this item for removal (only for 只提醒不动). */
  blocked: Schema.NullOr(Schema.String),
});
export type StorageTidyItem = typeof StorageTidyItem.Type;

export const StorageTidyMole = Schema.Struct({
  status: Schema.Literals(["found", "missing", "failed"]),
  binary: Schema.NullOr(Schema.String),
  /** Raw failure text from the program, never shown as a translated sentence. */
  message: Schema.NullOr(Schema.String),
  listed: Schema.Number,
  /** Paths from Mole's list that this app's own rules refused to touch. */
  ignored: Schema.Number,
});
export type StorageTidyMole = typeof StorageTidyMole.Type;

export const StorageTidyVolume = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  path: Schema.String,
  totalBytes: Schema.NullOr(Schema.Number),
  freeBytes: Schema.Number,
  internal: Schema.Boolean,
});
export type StorageTidyVolume = typeof StorageTidyVolume.Type;

export const StorageTidyScan = Schema.Struct({
  scannedAt: Schema.String,
  items: Schema.Array(StorageTidyItem),
  mole: StorageTidyMole,
  truncated: Schema.Boolean,
  /** Where cleanup could not look because the setting is empty. */
  buildDirectoryMissing: Schema.Boolean,
});
export type StorageTidyScan = typeof StorageTidyScan.Type;

export const StorageTidySettings = Schema.Struct({
  /** 我的构建目录: a folder of old build generations. Empty falls back to T3_CLEANUP_STAGING_DIR. */
  buildDirectory: Schema.String,
  keepNewest: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 20 })),
  rescueFirst: Schema.Boolean,
});
export type StorageTidySettings = typeof StorageTidySettings.Type;

export const StorageTidyOutcome = Schema.Struct({
  itemId: Schema.String,
  kind: StorageTidyKind,
  tier: StorageTidyTier,
  name: Schema.String,
  outcome: Schema.Literals(["deleted", "trashed", "skipped", "failed"]),
  bytes: Schema.Number,
  /** Raw reason for skipped/failed; written by the server's guards. */
  reason: Schema.NullOr(Schema.String),
});
export type StorageTidyOutcome = typeof StorageTidyOutcome.Type;

export const StorageTidyRescue = Schema.Struct({
  directory: Schema.String,
  assets: Schema.Number,
  patches: Schema.Number,
  untrackedArchives: Schema.Number,
  sessionArchives: Schema.Number,
  bytes: Schema.Number,
  dirtyRepos: Schema.Array(Schema.Struct({ name: Schema.String, files: Schema.Number })),
});
export type StorageTidyRescue = typeof StorageTidyRescue.Type;

export const StorageTidyOperation = Schema.Struct({
  id: Schema.String,
  startedAt: Schema.String,
  finishedAt: Schema.NullOr(Schema.String),
  phase: Schema.Literals(["running", "completed", "failed"]),
  volumePath: Schema.String,
  /** Bytes removed outright (放心清) and bytes now waiting in Trash (看一眼). */
  deletedBytes: Schema.Number,
  trashedBytes: Schema.Number,
  /** Bytes this run wrote to the same disk (rescue copies and transcript archives). */
  writtenBytes: Schema.Number,
  freeBefore: Schema.NullOr(Schema.Number),
  freeAfter: Schema.NullOr(Schema.Number),
  totalBytes: Schema.NullOr(Schema.Number),
  /** Items in Trash are removed by this app after seven days; null once emptied or undone. */
  recoverableUntil: Schema.NullOr(Schema.String),
  undone: Schema.Boolean,
  purged: Schema.Boolean,
  rescue: Schema.NullOr(StorageTidyRescue),
  entries: Schema.Array(StorageTidyOutcome),
  error: Schema.NullOr(Schema.String),
  progress: Schema.NullOr(Schema.Struct({ done: Schema.Number, total: Schema.Number })),
});
export type StorageTidyOperation = typeof StorageTidyOperation.Type;

export const StorageTidyState = Schema.Struct({
  settings: StorageTidySettings,
  volumes: Schema.Array(StorageTidyVolume),
  phase: Schema.Literals(["idle", "scanning", "executing"]),
  progress: Schema.Struct({ checked: Schema.Number, total: Schema.Number, step: Schema.String }),
  scan: Schema.NullOr(StorageTidyScan),
  operation: Schema.NullOr(StorageTidyOperation),
  /** Where rescued files and transcript archives go, shown with "~" for the home folder. */
  rescueRoot: Schema.String,
  /** Counts the page shows before anything is removed. */
  rescuePreview: Schema.NullOr(
    Schema.Struct({
      assets: Schema.Number,
      assetBytes: Schema.Number,
      dirtyRepos: Schema.Array(Schema.Struct({ name: Schema.String, files: Schema.Number })),
    }),
  ),
});
export type StorageTidyState = typeof StorageTidyState.Type;

export const StorageTidyStateInput = Schema.Struct({});
export type StorageTidyStateInput = typeof StorageTidyStateInput.Type;

export const StorageTidyActionInput = Schema.Union([
  Schema.Struct({ action: Schema.Literals(["scan"]) }),
  Schema.Struct({
    action: Schema.Literals(["execute"]),
    itemIds: Schema.Array(Schema.String).pipe(Schema.check(Schema.isMaxLength(500))),
    rescue: Schema.Boolean,
  }),
  Schema.Struct({ action: Schema.Literals(["undo"]), operationId: Schema.String }),
  Schema.Struct({
    action: Schema.Literals(["settings"]),
    buildDirectory: Schema.optionalKey(Schema.String),
    keepNewest: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 20 }))),
    rescueFirst: Schema.optionalKey(Schema.Boolean),
  }),
  Schema.Struct({ action: Schema.Literals(["open-archive"]), operationId: Schema.String }),
]);
export type StorageTidyActionInput = typeof StorageTidyActionInput.Type;

export class StorageTidyError extends Schema.TaggedError<StorageTidyError>()("StorageTidyError", {
  message: Schema.String,
}) {}
