import * as Schema from "effect/Schema";

export const StorageOperation = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  phase: Schema.String,
  createdAt: Schema.String,
  held: Schema.optionalKey(Schema.String),
  source: Schema.optionalKey(Schema.String),
  archive: Schema.optionalKey(Schema.String),
  destination: Schema.optionalKey(Schema.String),
  release: Schema.optionalKey(Schema.Boolean),
  cancelRequested: Schema.optionalKey(Schema.Boolean),
  warnings: Schema.optionalKey(Schema.Array(Schema.String)),
  cleanupObjectId: Schema.optionalKey(Schema.String),
  cleanupDestination: Schema.optionalKey(
    Schema.Literals(["delete-rebuildable", "trash", "move-external"]),
  ),
  recoverableUntil: Schema.optionalKey(Schema.String),
  sourceBytes: Schema.Number,
  reserveGiB: Schema.optionalKey(Schema.Number),
  freeBefore: Schema.optionalKey(Schema.Number),
  freeAfter: Schema.optionalKey(Schema.Number),
  error: Schema.optionalKey(Schema.String),
  spacePath: Schema.optionalKey(Schema.String),
  items: Schema.optionalKey(
    Schema.Array(Schema.Struct({ path: Schema.String, bytes: Schema.Number })),
  ),
});
export type StorageOperation = typeof StorageOperation.Type;
export const StorageInspection = Schema.Struct({
  checkedAt: Schema.String,
  entries: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      path: Schema.String,
      category: Schema.optionalKey(Schema.String),
      risk: Schema.optionalKey(Schema.Literals(["safe", "caution", "confirm"])),
      destination: Schema.optionalKey(
        Schema.Literals(["delete-rebuildable", "trash", "move-external"]),
      ),
      childPaths: Schema.optionalKey(Schema.Array(Schema.String)),
      cleanupEvidence: Schema.optionalKey(
        Schema.Array(Schema.Struct({ path: Schema.String, sha256: Schema.String })),
      ),
      lastModified: Schema.optionalKey(Schema.String),
      rebuildable: Schema.optionalKey(Schema.Boolean),
      locked: Schema.optionalKey(Schema.Boolean),
      kind: Schema.String,
      reason: Schema.String,
      canRelease: Schema.Boolean,
      canArchive: Schema.optionalKey(Schema.Boolean),
      canExpand: Schema.optionalKey(Schema.Boolean),
      volumePath: Schema.optionalKey(Schema.String),
      modifiedAt: Schema.optionalKey(Schema.String),
      bytes: Schema.optionalKey(Schema.NullOr(Schema.Number)),
    }),
  ),
  archives: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      path: Schema.String,
      source: Schema.String,
      online: Schema.Boolean,
      bytes: Schema.Number,
      restorable: Schema.Boolean,
    }),
  ),
  volumes: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      path: Schema.String,
      freeBytes: Schema.Number,
      totalBytes: Schema.optionalKey(Schema.Number),
      internal: Schema.optionalKey(Schema.Boolean),
      reserveGiB: Schema.optionalKey(Schema.Number),
      history: Schema.optionalKey(
        Schema.Array(Schema.Struct({ at: Schema.String, freeBytes: Schema.Number })),
      ),
    }),
  ),
  operations: Schema.Array(StorageOperation),
  scan: Schema.optionalKey(
    Schema.Struct({
      phase: Schema.Literals(["scanning", "completed"]),
      requestId: Schema.optionalKey(Schema.Number),
      checked: Schema.Number,
      total: Schema.Number,
      current: Schema.String,
      truncated: Schema.Boolean,
    }),
  ),
  scanOnOpenDaily: Schema.optionalKey(Schema.Boolean),
  truncated: Schema.optionalKey(Schema.Boolean),
});
export type StorageInspection = typeof StorageInspection.Type;
export const StorageInspectInput = Schema.Struct({
  objectId: Schema.optionalKey(Schema.String),
  measureSizes: Schema.optionalKey(Schema.Boolean),
  statusOnly: Schema.optionalKey(Schema.Boolean),
  scanRequest: Schema.optionalKey(Schema.Number),
});
export type StorageInspectInput = typeof StorageInspectInput.Type;
export const StorageActionInput = Schema.Union([
  Schema.Struct({ action: Schema.Literals(["cleanup-plan"]), objectId: Schema.String }),
  Schema.Struct({
    action: Schema.Literals(["cleanup-settings"]),
    volumePath: Schema.optionalKey(Schema.String),
    reserveGiB: Schema.optionalKey(
      Schema.Number.pipe(Schema.check(Schema.isBetween({ minimum: 40, maximum: 1024 }))),
    ),
    scanOnOpenDaily: Schema.optionalKey(Schema.Boolean),
  }),
  Schema.Struct({ action: Schema.Literals(["logs-plan"]) }),
  Schema.Struct({
    action: Schema.Literals(["plan"]),
    objectId: Schema.String,
    volumeId: Schema.String,
    mode: Schema.Literals(["archive-only", "archive-and-release"]),
  }),
  Schema.Struct({
    action: Schema.Literals(["restore-plan"]),
    objectId: Schema.String,
    volumeId: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({
    action: Schema.Literals(["execute", "cancel", "reconcile"]),
    planId: Schema.String,
  }),
]);
export type StorageActionInput = typeof StorageActionInput.Type;
export class StorageManagementError extends Schema.TaggedError<StorageManagementError>()(
  "StorageManagementError",
  { message: Schema.String },
) {}
