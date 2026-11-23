import type { StorageTidyItem, StorageTidyOperation, StorageTidyVolume } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";

import {
  completionSummary,
  defaultSelection,
  isSelectable,
  itemsByTier,
  recoveryDaysLeft,
  selectionSummary,
} from "./storageTidyModel";

const GB = 1024 ** 3;
const item = (over: Partial<StorageTidyItem> & { id: string }): StorageTidyItem => ({
  tier: "safe",
  kind: "mole-section",
  group: "mole",
  name: "x",
  tool: "mole",
  detail: {},
  lastUsed: null,
  bytes: GB,
  fileCount: 1,
  paths: [],
  pathCount: 1,
  disposal: "delete",
  compress: false,
  dirtyFiles: 0,
  rescueAssets: 0,
  rescueAssetBytes: 0,
  blocked: null,
  ...over,
});
const volume: StorageTidyVolume = {
  id: "v",
  name: "Macintosh HD",
  path: "/",
  totalBytes: 500 * GB,
  freeBytes: 40 * GB,
  internal: true,
};

it("preselects only 放心清 and never offers a checkbox for 只提醒不动", () => {
  const items = [
    item({ id: "a" }),
    item({ id: "b", tier: "review", disposal: "trash" }),
    item({ id: "c", tier: "remind", disposal: "none", blocked: "dirty-worktree" }),
    item({ id: "d", bytes: 0 }),
  ];
  expect([...defaultSelection(items)]).toEqual(["a"]);
  expect(items.map(isSelectable)).toEqual([true, true, false, false]);
  expect(Object.values(itemsByTier({ scannedAt: "", items, mole: { status: "missing", binary: null, message: null, listed: 0, ignored: 0 }, truncated: false, buildDirectoryMissing: false })).map((l) => l.length)).toEqual([2, 1, 1]);
});

it("counts only deleted bytes as freed now; Trash is pending", () => {
  const items = [
    item({ id: "a", bytes: 10 * GB }),
    item({ id: "b", tier: "review", disposal: "trash", bytes: 20 * GB, rescueAssets: 5, rescueAssetBytes: 1000 }),
  ];
  const summary = selectionSummary(items, new Set(["a", "b"]), volume);
  expect(summary).toMatchObject({ count: 2, freeNow: 10 * GB, pending: 20 * GB, bytes: 30 * GB, rescueAssets: 5, hasTrash: true });
  expect(summary.freeAfter).toBe(50 * GB);
  expect(summary.usedPercentAfter).toBe(Math.round(((500 - 50) / 500) * 100));
  expect(selectionSummary(items, new Set(["b"]), volume).freeNow).toBe(0);
});

const operation = (over: Partial<StorageTidyOperation>): StorageTidyOperation => ({
  id: "op-1",
  startedAt: "2026-11-22T06:00:00.000Z",
  finishedAt: "2026-11-22T06:01:00.000Z",
  phase: "completed",
  volumePath: "/",
  deletedBytes: 55.2 * GB,
  trashedBytes: 17 * GB,
  writtenBytes: 0.2 * GB,
  freeBefore: 40 * GB,
  freeAfter: 95 * GB,
  totalBytes: 500 * GB,
  recoverableUntil: "2026-11-29T06:01:00.000Z",
  undone: false,
  purged: false,
  rescue: null,
  entries: [
    { itemId: "a", kind: "mole-section", tier: "safe", name: "a", outcome: "deleted", bytes: 1, reason: null },
    { itemId: "b", kind: "app-backup", tier: "review", name: "b", outcome: "trashed", bytes: 1, reason: null },
    { itemId: "c", kind: "worktree", tier: "remind", name: "c", outcome: "skipped", bytes: 0, reason: "dirty-worktree" },
  ],
  error: null,
  progress: null,
  ...over,
});

it("subtracts what the run wrote to the same disk and reports pending Trash honestly", () => {
  const summary = completionSummary(operation({}));
  expect(summary.freedNow).toBeCloseTo(55 * GB, -6);
  expect(summary.pending).toBe(17 * GB);
  expect(summary.usedBeforePercent).toBe(92);
  expect(summary.usedAfterPercent).toBe(81);
  expect(summary.usedAfterPendingPercent).toBe(78);
  expect(summary).toMatchObject({ trashed: 1, deleted: 1, problems: 1 });
});

it("shows no pending space after undo or after the Trash batch was emptied", () => {
  expect(completionSummary(operation({ undone: true })).pending).toBe(0);
  expect(completionSummary(operation({ purged: true })).pending).toBe(0);
  expect(completionSummary(operation({ writtenBytes: 999 * GB })).freedNow).toBe(0);
});

it("rounds recovery days up", () => {
  const now = Date.parse("2026-11-22T06:01:00.000Z");
  expect(recoveryDaysLeft("2026-11-29T06:01:00.000Z", now)).toBe(7);
  expect(recoveryDaysLeft("2026-11-22T07:01:00.000Z", now)).toBe(1);
  expect(recoveryDaysLeft(null, now)).toBeNull();
});
