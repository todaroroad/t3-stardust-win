import type {
  StorageTidyItem,
  StorageTidyOperation,
  StorageTidyScan,
  StorageTidyTier,
  StorageTidyVolume,
} from "@t3tools/contracts";

export const TIDY_TIERS: ReadonlyArray<StorageTidyTier> = ["safe", "review", "remind"];
export const DAY_MS = 86_400_000;

export const MOLE_REPOSITORY_URL = "https://github.com/tw93/Mole";
export const MOLE_INSTALL_COMMAND = "brew install mole";

export function itemsByTier(scan: StorageTidyScan | null) {
  const tiers: Record<StorageTidyTier, StorageTidyItem[]> = { safe: [], review: [], remind: [] };
  for (const item of scan?.items ?? []) tiers[item.tier].push(item);
  return tiers;
}

export function sumBytes(items: ReadonlyArray<StorageTidyItem>) {
  return items.reduce((total, item) => total + item.bytes, 0);
}

/** Items the page may offer a checkbox for. 只提醒不动 never gets one. */
export const isSelectable = (item: StorageTidyItem) =>
  item.tier !== "remind" && item.disposal !== "none" && item.bytes > 0;

/** 放心清 starts selected; 看一眼 always waits for the person to look. */
export function defaultSelection(items: ReadonlyArray<StorageTidyItem>): ReadonlySet<string> {
  return new Set(items.filter((item) => item.tier === "safe" && isSelectable(item)).map((i) => i.id));
}

export function selectionSummary(
  items: ReadonlyArray<StorageTidyItem>,
  selected: ReadonlySet<string>,
  volume: StorageTidyVolume | undefined,
) {
  const chosen = items.filter((item) => selected.has(item.id) && isSelectable(item));
  const freeNow = sumBytes(chosen.filter((item) => item.disposal === "delete"));
  const pending = sumBytes(chosen.filter((item) => item.disposal === "trash"));
  const rescueAssets = chosen.reduce((n, item) => n + (item.tier === "review" || item.kind === "worktree" ? item.rescueAssets : 0), 0);
  const rescueBytes = chosen.reduce((n, item) => n + (item.tier === "review" || item.kind === "worktree" ? item.rescueAssetBytes : 0), 0);
  const dirtyFiles = chosen.reduce((n, item) => n + item.dirtyFiles, 0);
  const free = volume?.freeBytes ?? null;
  const total = volume?.totalBytes ?? null;
  return {
    count: chosen.length,
    bytes: freeNow + pending,
    freeNow,
    pending,
    rescueAssets,
    rescueBytes,
    dirtyFiles,
    freeAfter: free === null ? null : free + freeNow,
    usedPercentAfter: free === null || total === null || total <= 0 ? null : Math.round(((total - free - freeNow) / total) * 100),
    hasTrash: pending > 0,
  };
}

export function usedPercent(volume: StorageTidyVolume | undefined) {
  if (!volume || volume.totalBytes === null || volume.totalBytes <= 0) return null;
  return Math.round(((volume.totalBytes - volume.freeBytes) / volume.totalBytes) * 100);
}

/**
 * What a finished run really did to the disk. macOS keeps Trash on the same volume, so bytes moved
 * to Trash are not freed until it is emptied; copies made for rescue and archives take space now.
 */
export function completionSummary(operation: StorageTidyOperation) {
  const freedNow = Math.max(0, operation.deletedBytes - operation.writtenBytes);
  const pending = operation.purged || operation.undone ? 0 : operation.trashedBytes;
  const total = operation.totalBytes;
  const before = operation.freeBefore;
  const measuredAfter = operation.freeAfter;
  const freeAfter = measuredAfter ?? (before === null ? null : before + freedNow);
  const percent = (free: number | null) =>
    free === null || total === null || total <= 0 ? null : Math.round(((total - free) / total) * 100);
  return {
    freedNow,
    pending,
    writtenBytes: operation.writtenBytes,
    deletedBytes: operation.deletedBytes,
    freeBefore: before,
    freeAfter,
    freeAfterPending: freeAfter === null ? null : freeAfter + pending,
    usedBeforePercent: percent(before),
    usedAfterPercent: percent(freeAfter),
    usedAfterPendingPercent: percent(freeAfter === null ? null : freeAfter + pending),
    total,
    trashed: operation.entries.filter((entry) => entry.outcome === "trashed").length,
    deleted: operation.entries.filter((entry) => entry.outcome === "deleted").length,
    problems: operation.entries.filter((entry) => entry.outcome === "failed" || entry.outcome === "skipped").length,
  };
}

/** Whole days between two instants, never negative. */
export function daysBetween(from: string | null, nowMs: number): number | null {
  if (from === null) return null;
  const parsed = Date.parse(from);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor((nowMs - parsed) / DAY_MS)) : null;
}

export function secondsLeft(until: string | null, nowMs: number): number | null {
  if (until === null) return null;
  const parsed = Date.parse(until);
  return Number.isFinite(parsed) ? Math.max(0, Math.ceil((parsed - nowMs) / 1000)) : null;
}

/** Days left to undo, rounded up so "6 days" never reads as "0". */
export function recoveryDaysLeft(until: string | null, nowMs: number): number | null {
  const seconds = secondsLeft(until, nowMs);
  return seconds === null ? null : Math.ceil(seconds / 86_400);
}
