import type { StorageTidyItem, StorageTidyOperation, StorageTidyVolume } from "@t3tools/contracts";
import { LifeBuoyIcon } from "lucide-react";

import { readUiLocale } from "~/i18n";
import { useUiText } from "~/i18n/useUiText";
import { cn } from "~/lib/utils";
import { formatBytes } from "../../lib/formatBytes";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { StorageTidyDonut } from "./StorageTidyDonut";
import { TIER_COLORS } from "./StorageTidyOverview";
import { StorageTidyNotes } from "./StorageTidyResults";
import { itemCopy, outcomeReason } from "./storageTidyCopy";
import { completionSummary, recoveryDaysLeft } from "./storageTidyModel";


function splitBytes(bytes: number) {
  const [value = "0", unit = "B"] = formatBytes(bytes).split(" ");
  return { value, unit };
}

const placeholderItem = (entry: StorageTidyOperation["entries"][number]): StorageTidyItem => ({
  id: entry.itemId,
  tier: entry.tier,
  kind: entry.kind,
  group: "",
  name: entry.name,
  tool: entry.name,
  detail: {},
  lastUsed: null,
  bytes: entry.bytes,
  fileCount: 0,
  paths: [],
  pathCount: 0,
  disposal: "none",
  compress: false,
  dirtyFiles: 0,
  rescueAssets: 0,
  rescueAssetBytes: 0,
  blocked: null,
});

function Bar({
  label,
  caption,
  dark,
  hatched,
  hatchTone,
}: {
  readonly label: string;
  readonly caption: React.ReactNode;
  readonly dark: number;
  readonly hatched: number;
  readonly hatchTone: "pending" | "freed";
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <span className="h-full bg-foreground/80" style={{ width: `${Math.max(0, dark)}%` }} />
        <span
          className="h-full"
          style={{
            width: `${Math.max(0, hatched)}%`,
            backgroundImage: `repeating-linear-gradient(45deg, ${hatchTone === "pending" ? "var(--warning)" : "var(--success)"} 0 3px, transparent 3px 6px)`,
          }}
        />
      </div>
      <span />
      <span className="text-xs tabular-nums text-muted-foreground">{caption}</span>
    </div>
  );
}

export function StorageTidyDone({
  operation,
  volume,
  nowMs,
  busy,
  onUndo,
  onOpenArchive,
  onFinish,
}: {
  readonly operation: StorageTidyOperation;
  readonly volume: StorageTidyVolume | undefined;
  readonly nowMs: number;
  readonly busy: boolean;
  readonly onUndo: () => void;
  readonly onOpenArchive: () => void;
  readonly onFinish: () => void;
}) {
  const t = useUiText();
  const s = completionSummary(operation);
  const total = s.total ?? 0;
  const pct = (bytes: number) => (total > 0 ? (bytes / total) * 100 : 0);
  const free = s.freeAfter ?? 0;
  const used = Math.max(0, total - free);
  const freed = splitBytes(s.freedNow);
  const daysLeft = recoveryDaysLeft(operation.recoverableUntil, nowMs);
  const releaseDate = operation.recoverableUntil
    ? new Date(operation.recoverableUntil).toLocaleDateString(readUiLocale(), { month: "long", day: "numeric" })
    : null;
  const finished = operation.finishedAt ? new Date(operation.finishedAt) : null;
  const canUndo = s.trashed > 0 && !operation.undone && !operation.purged && daysLeft !== null && daysLeft > 0;
  const rescue = operation.rescue;
  const rescued = rescue ? rescue.assets + rescue.patches + rescue.untrackedArchives + rescue.sessionArchives : 0;
  return (
    <div className="space-y-8" data-testid="tidy-done">
      <div className="grid items-center gap-x-10 gap-y-6 md:grid-cols-[300px_minmax(0,1fr)]">
        <StorageTidyDonut
          label={t("Capacity of {name}", { name: volume?.name ?? "" })}
          segments={[
            { id: "used", value: Math.max(0, used - s.pending), color: TIER_COLORS.used },
            { id: "pending", value: s.pending, color: "var(--warning)", hatched: true },
            { id: "free", value: free, color: "var(--muted)", outline: true },
          ]}
        >
          <div className="text-center">
            <div className="text-xs text-muted-foreground">{t("Used now")}</div>
            <div className="text-4xl font-bold tabular-nums">
              {s.usedAfterPercent ?? "–"}
              <span className="text-lg font-medium text-muted-foreground">%</span>
            </div>
            <div className="text-2xs text-muted-foreground">
              {t("{size} free", { size: formatBytes(free) })}
            </div>
            {s.pending > 0 && s.freeAfterPending !== null ? (
              <div className="text-2xs text-muted-foreground">
                {t("{size} free in 7 days", { size: formatBytes(s.freeAfterPending) })}
              </div>
            ) : null}
          </div>
        </StorageTidyDonut>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={operation.phase === "failed" ? "error" : "success"} size="lg">
              {operation.phase === "failed" ? t("Cleanup failed") : operation.undone ? t("Undone") : t("Cleanup finished")}
            </Badge>
            <span>
              {volume?.name ?? ""}
              {finished ? ` · ${finished.toLocaleString(readUiLocale(), { dateStyle: "medium", timeStyle: "short" })}` : ""}
            </span>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{t("Actually freed")}</div>
            <div className="text-7xl font-bold leading-none tracking-tight tabular-nums" data-testid="freed-now">
              {freed.value}
              <span className="ml-1.5 text-3xl font-semibold text-muted-foreground">{freed.unit}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("(Rebuildable caches deleted {deleted} − {written} written to this disk for rescue and archives)", {
              deleted: formatBytes(s.deletedBytes),
              written: formatBytes(s.writtenBytes),
            })}
          </p>
          {s.pending > 0 ? (
            <p className="flex items-center gap-2 text-sm">
              <span className="size-3 rounded-sm" style={{ backgroundImage: "repeating-linear-gradient(45deg, var(--warning) 0 2px, transparent 2px 4px)" }} />
              <span>
                {t("Still in Trash {size}", { size: formatBytes(s.pending) })}
                {releaseDate ? ` · ${t("freed when it is emptied on {date}", { date: releaseDate })}` : ""}
              </span>
            </p>
          ) : null}
          {total > 0 && s.freeBefore !== null ? (
            <div className="space-y-2 pt-2">
              <Bar
                label={t("Before")}
                dark={pct(total - s.freeBefore)}
                hatched={0}
                hatchTone="pending"
                caption={t("{percent}% used · {size} free", { percent: s.usedBeforePercent ?? 0, size: formatBytes(s.freeBefore) })}
              />
              <Bar
                label={t("After")}
                dark={pct(used - s.pending)}
                hatched={pct(s.pending)}
                hatchTone="pending"
                caption={t("{percent}% used · {size} free (Trash still holds {pending})", { percent: s.usedAfterPercent ?? 0, size: formatBytes(free), pending: formatBytes(s.pending) })}
              />
              {s.pending > 0 ? (
                <Bar
                  label={t("In 7 days")}
                  dark={pct(used - s.pending)}
                  hatched={pct(s.pending)}
                  hatchTone="freed"
                  caption={t("About {percent}% used · {size} free", { percent: s.usedAfterPendingPercent ?? 0, size: formatBytes(s.freeAfterPending ?? 0) })}
                />
              ) : null}
            </div>
          ) : null}
          {s.freeBefore !== null && s.freeAfter !== null ? (
            <p className="text-2xs text-muted-foreground">
              {t("Measured free space: {before} → {after}. This includes anything else the disk did meanwhile.", {
                before: formatBytes(s.freeBefore),
                after: formatBytes(s.freeAfter),
              })}
            </p>
          ) : null}
        </div>
      </div>

      {s.trashed > 0 ? (
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5" data-testid="undo-card">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-sm font-semibold">{t("Items in Trash can be undone for 7 days")}</h3>
            <p className="text-xs text-muted-foreground">
              {operation.undone
                ? t("Everything was put back.")
                : operation.purged
                  ? t("The 7 days are over and this app emptied its Trash batch, so it can no longer be restored.")
                  : t("{count} items · {size} in Trash · emptied automatically after {days} more days, and cannot be restored after that.", {
                      count: s.trashed,
                      size: formatBytes(s.pending),
                      days: daysLeft ?? 0,
                    })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("Caches deleted directly ({size}) are not covered by undo. The apps rebuild them when needed.", { size: formatBytes(s.deletedBytes) })}
            </p>
          </div>
          <Button disabled={busy || !canUndo} onClick={onUndo}>
            {t("Undo what went to Trash")}
          </Button>
        </section>
      ) : null}

      {rescue && rescued > 0 ? (
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5" data-testid="rescue-done">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LifeBuoyIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">
                {t("Rescued {count} files · {size}", { count: rescue.assets.toLocaleString(), size: formatBytes(rescue.bytes) })}
              </h3>
              {rescue.dirtyRepos.length > 0 ? (
                <Badge variant="warning" size="sm">
                  {t("{count} places with uncommitted changes", { count: rescue.dirtyRepos.length })}
                </Badge>
              ) : null}
              {rescue.sessionArchives > 0 ? (
                <Badge variant="info" size="sm">{t("{count} transcript archives", { count: rescue.sessionArchives })}</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {rescue.dirtyRepos.map((repo) => t("{name}: {count} uncommitted files", { name: repo.name, count: repo.files })).join(" · ")}
              {rescue.dirtyRepos.length > 0 ? " · " : ""}
              {t("Saved in {path}. It uses space on this disk, and that is already counted above.", { path: rescue.directory })}
            </p>
          </div>
          <Button onClick={onOpenArchive}>{t("Open archive")}</Button>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("What this run did")}</h2>
        <ul className="overflow-hidden rounded-2xl border border-border bg-card">
          {operation.entries.map((entry) => {
            const copy = itemCopy(t, placeholderItem(entry));
            const reason = outcomeReason(t, entry);
            return (
              <li key={entry.itemId} data-testid="tidy-outcome" data-outcome={entry.outcome} className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm last:border-b-0">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.outcome === "deleted" ? TIER_COLORS.safe : entry.outcome === "trashed" ? TIER_COLORS.review : "var(--muted-foreground)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{copy.title}</span>
                  {reason ? <span className="block truncate text-xs text-muted-foreground">{reason}</span> : null}
                </span>
                <span className={cn("text-xs", entry.outcome === "failed" && "text-destructive")}>
                  {entry.outcome === "deleted" ? t("Deleted") : entry.outcome === "trashed" ? t("In Trash") : entry.outcome === "skipped" ? t("Skipped") : t("Failed")}
                </span>
                <span className="w-20 text-right tabular-nums text-muted-foreground">{entry.bytes > 0 ? formatBytes(entry.bytes) : ""}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <StorageTidyNotes />
      <div className="flex justify-end">
        <Button variant="outline" onClick={onFinish}>{t("Done")}</Button>
      </div>
    </div>
  );
}

