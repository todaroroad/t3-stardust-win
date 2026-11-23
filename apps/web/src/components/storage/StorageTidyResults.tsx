import type { StorageTidyItem, StorageTidyState, StorageTidyTier, StorageTidyVolume } from "@t3tools/contracts";
import { ChevronRightIcon, CopyIcon, LifeBuoyIcon, PackageIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useUiText } from "~/i18n/useUiText";
import { cn } from "~/lib/utils";
import { formatBytes } from "../../lib/formatBytes";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Switch } from "../ui/switch";
import { TIER_COLORS } from "./StorageTidyOverview";
import { blockedCopy, itemCopy, relativeDays } from "./storageTidyCopy";
import {
  MOLE_REPOSITORY_URL,
  isSelectable,
  itemsByTier,
  selectionSummary,
  sumBytes,
} from "./storageTidyModel";

const GROUP_TITLES: Readonly<Record<string, string>> = {
  mole: "System and app caches (Mole rules)",
  dev: "Developer caches",
  worktrees: "Agent worktrees",
  tmp: "Agent temporary folders",
  sessions: "AI session transcripts",
  builds: "Rollback copies and build backups",
  protected: "Protected",
};

function groupItems(items: ReadonlyArray<StorageTidyItem>) {
  const groups = new Map<string, StorageTidyItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups];
}

export function StorageTidyNotes({ className }: { readonly className?: string }) {
  const t = useUiText();
  return (
    <div className={cn("space-y-1 text-xs text-muted-foreground", className)}>
      <p>
        {t(
          "System cache lists come from the preview of the open-source tool Mole (tw93/Mole, GPL-3.0). T3 Stardust carries out the removal and supports undo. This feature is not affiliated with the Mole project.",
        )}
      </p>
      <p>{t("Deletion is decided by fixed rules, not by an AI model.")}</p>
    </div>
  );
}

function TierHeading({
  tier,
  items,
  selected,
  onToggleAll,
}: {
  readonly tier: StorageTidyTier;
  readonly items: ReadonlyArray<StorageTidyItem>;
  readonly selected: ReadonlySet<string>;
  readonly onToggleAll: (ids: ReadonlyArray<string>, checked: boolean) => void;
}) {
  const t = useUiText();
  const selectable = items.filter(isSelectable);
  const chosen = selectable.filter((item) => selected.has(item.id));
  const title =
    tier === "safe" ? t("Safe to clean") : tier === "review" ? t("Take a look") : t("Remind only");
  const description =
    tier === "safe"
      ? t("Caches that rebuild themselves. Deleted directly, and the space comes back at once.")
      : tier === "review"
        ? t(
            "Probably removable, but they may hold something you still want. They go to Trash and can be undone for 7 days, but Trash still occupies the disk until this app empties it after 7 days.",
          )
        : t("Shown so you know about them. This page never deletes them.");
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 max-w-[44rem]">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[tier] }} />
          {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold tabular-nums">{formatBytes(sumBytes(items))}</span>
        {selectable.length > 0 ? (
          <>
            <span className="text-muted-foreground tabular-nums">
              {t("{selected} of {total} selected", { selected: chosen.length, total: selectable.length })}
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
              <Checkbox
                checked={chosen.length === selectable.length}
                indeterminate={chosen.length > 0 && chosen.length < selectable.length}
                onCheckedChange={(checked) =>
                  onToggleAll(selectable.map((item) => item.id), checked === true)
                }
                aria-label={t("Select all in {tier}", { tier: title })}
              />
              {t("Select all")}
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-stardust-body">{children}</dd>
    </div>
  );
}

export function TidyItemRow({
  item,
  selected,
  onToggle,
  nowMs,
}: {
  readonly item: StorageTidyItem;
  readonly selected: boolean;
  readonly onToggle: (id: string, checked: boolean) => void;
  readonly nowMs: number;
}) {
  const t = useUiText();
  const [open, setOpen] = useState(false);
  const copy = itemCopy(t, item);
  const selectable = isSelectable(item);
  const reason = item.tier === "remind" ? blockedCopy(t, item) : "";
  return (
    <li data-testid="tidy-item" data-tier={item.tier} data-kind={item.kind} className="border-b border-border/60 last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <Checkbox
          checked={selected}
          disabled={!selectable}
          onCheckedChange={(checked) => onToggle(item.id, checked === true)}
          aria-label={t("Select {name}", { name: copy.title })}
        />
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold">{copy.title}</span>
              {copy.badge ? <Badge variant="info" size="sm">{copy.badge}</Badge> : null}
              {item.disposal === "trash" ? (
                <Badge variant="warning" size="sm">{t("Trash")}</Badge>
              ) : null}
              {item.dirtyFiles > 0 && item.tier === "review" ? (
                <Badge variant="warning" size="sm">{t("Uncommitted · rescued first")}</Badge>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {reason || copy.subtitle}
            </span>
          </span>
          <span className="text-right tabular-nums">
            <span className="block text-sm font-semibold">{formatBytes(item.bytes)}</span>
          </span>
          <ChevronRightIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        </button>
      </div>
      {open ? (
        <dl className="grid gap-x-8 gap-y-3 border-t border-border/40 bg-muted/30 px-4 py-3.5 pl-11 sm:grid-cols-2">
          <Fact label={t("What it is")}>{copy.what}</Fact>
          <Fact label={t("Produced by")}>{copy.tool}</Fact>
          <Fact label={t("Last used")}>{relativeDays(t, item.lastUsed, nowMs)}</Fact>
          <Fact label={t("Size")}>
            {formatBytes(item.bytes)}
            {item.fileCount > 0 ? ` · ${t("{count} files", { count: item.fileCount })}` : ""}
          </Fact>
          <Fact label={item.tier === "remind" ? t("Why it is left alone") : t("Why it can go")}>
            {item.tier === "remind" ? (reason || copy.why) : copy.why}
          </Fact>
          {copy.recover ? <Fact label={t("How to get it back")}>{copy.recover}</Fact> : null}
          <div className="sm:col-span-2">
            <Fact label={item.pathCount > 1 ? t("Paths ({count})", { count: item.pathCount }) : t("Path")}>
              <span className="block space-y-0.5 font-mono text-2xs text-muted-foreground">
                {item.paths.map((path) => (
                  <span key={path} className="block break-all">{path}</span>
                ))}
                {item.pathCount > item.paths.length ? (
                  <span className="block">{t("and {count} more", { count: item.pathCount - item.paths.length })}</span>
                ) : null}
              </span>
            </Fact>
          </div>
        </dl>
      ) : null}
    </li>
  );
}

function MoleMissingRow({ onCopy }: { readonly onCopy: () => void }) {
  const t = useUiText();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3" data-testid="mole-missing">
      <PackageIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">{t("Mole is not installed")}</div>
        <div className="text-xs text-muted-foreground">
          {t("Install it to add a list of system and app caches here. Nothing is installed automatically.")}
        </div>
      </div>
      <Button size="xs" variant="outline" onClick={onCopy}>
        <CopyIcon />
        {t("Install Mole")}
      </Button>
      <a
        className="text-xs underline underline-offset-2"
        href={MOLE_REPOSITORY_URL}
        target="_blank"
        rel="noreferrer"
      >
        tw93/Mole
      </a>
    </div>
  );
}

function RescueCard({
  state,
  summary,
  enabled,
  onChange,
  dateLabel,
}: {
  readonly state: StorageTidyState;
  readonly summary: ReturnType<typeof selectionSummary>;
  readonly enabled: boolean;
  readonly onChange: (enabled: boolean) => void;
  readonly dateLabel: string;
}) {
  const t = useUiText();
  const preview = state.rescuePreview;
  if (!preview || (preview.assets === 0 && preview.dirtyRepos.length === 0)) return null;
  const dirtyFiles = preview.dirtyRepos.reduce((n, repo) => n + repo.files, 0);
  return (
    <section className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs/5" data-testid="rescue-card">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <LifeBuoyIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{t("Rescue first, then clean")}</h3>
          <Badge variant="info" size="sm">{t("Runs before deleting")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("Before deleting, this saves a copy: {assets} visual assets · {repos} places with uncommitted changes ({files} files) → {path}", {
            assets: preview.assets.toLocaleString(),
            repos: preview.dirtyRepos.length,
            files: dirtyFiles.toLocaleString(),
            path: `${state.rescueRoot}/${dateLabel}`,
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("The current selection rescues {count} assets ({size}). Folders with uncommitted changes only appear in Take a look, never in Safe to clean.", {
            count: summary.rescueAssets.toLocaleString(),
            size: formatBytes(summary.rescueBytes),
          })}
        </p>
        {preview.dirtyRepos.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.dirtyRepos.map((repo) => (
              <Badge key={repo.name} variant="warning" size="sm">
                {t("{name}: {count} uncommitted files", { name: repo.name, count: repo.files })}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <Switch checked={enabled} onCheckedChange={onChange} aria-label={t("Rescue first, then clean")} />
    </section>
  );
}

export function ActionBar({
  summary,
  rescueEnabled,
  busy,
  onExecute,
  onRescan,
  volume,
}: {
  readonly summary: ReturnType<typeof selectionSummary>;
  readonly rescueEnabled: boolean;
  readonly busy: boolean;
  readonly onExecute: () => void;
  readonly onRescan: () => void;
  readonly volume: StorageTidyVolume | undefined;
}) {
  const t = useUiText();
  return (
    <div
      className="sticky bottom-4 z-10 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border bg-popover/95 px-5 py-3.5 shadow-lg backdrop-blur"
      data-testid="tidy-action-bar"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{t("{count} items selected", { count: summary.count })}</span>
          <span className="tabular-nums text-muted-foreground">{formatBytes(summary.bytes)}</span>
          {rescueEnabled && (summary.rescueAssets > 0 || summary.dirtyFiles > 0) ? (
            <Badge variant="info" size="sm">{t("Rescue first")}</Badge>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {t("Freed now")} <b className="text-foreground">{formatBytes(summary.freeNow)}</b>
          {summary.hasTrash ? (
            <> · {t("In Trash {size}, freed in 7 days", { size: formatBytes(summary.pending) })}</>
          ) : null}
        </div>
        {summary.freeAfter !== null && volume ? (
          <div className="text-xs text-muted-foreground tabular-nums">
            {t("About {free} free afterwards", { free: formatBytes(summary.freeAfter) })}
            {summary.usedPercentAfter !== null ? ` · ${t("Used {percent}%", { percent: summary.usedPercentAfter })}` : ""}
          </div>
        ) : null}
      </div>
      <Button variant="ghost" onClick={onRescan} disabled={busy}>{t("Scan again")}</Button>
      <Button size="lg" disabled={busy || summary.count === 0} onClick={onExecute}>
        {summary.hasTrash && summary.freeNow === 0
          ? t("Move to Trash")
          : summary.hasTrash
            ? t("Clean selected")
            : t("Delete and free the space")}
      </Button>
    </div>
  );
}

export function StorageTidyResults({
  state,
  volume,
  selected,
  rescueEnabled,
  busy,
  nowMs,
  dateLabel,
  onToggle,
  onToggleMany,
  onRescueChange,
  onExecute,
  onRescan,
  onCopyMoleInstall,
  settingsHint,
}: {
  readonly state: StorageTidyState;
  readonly volume: StorageTidyVolume | undefined;
  readonly selected: ReadonlySet<string>;
  readonly rescueEnabled: boolean;
  readonly busy: boolean;
  readonly nowMs: number;
  readonly dateLabel: string;
  readonly onToggle: (id: string, checked: boolean) => void;
  readonly onToggleMany: (ids: ReadonlyArray<string>, checked: boolean) => void;
  readonly onRescueChange: (enabled: boolean) => void;
  readonly onExecute: () => void;
  readonly onRescan: () => void;
  readonly onCopyMoleInstall: () => void;
  readonly settingsHint?: ReactNode;
}) {
  const t = useUiText();
  const scan = state.scan;
  if (!scan) return null;
  const tiers = itemsByTier(scan);
  const summary = selectionSummary(scan.items, selected, volume);
  const sections: ReadonlyArray<StorageTidyTier> = ["safe", "review", "remind"];
  return (
    <div className="space-y-8" data-testid="tidy-results">
      <RescueCard state={state} summary={summary} enabled={rescueEnabled} onChange={onRescueChange} dateLabel={dateLabel} />
      {sections.map((tier) => {
        const items = tiers[tier];
        const groups = groupItems(items);
        const moleRow =
          tier === "safe" && scan.mole.status === "missing" ? <MoleMissingRow onCopy={onCopyMoleInstall} /> : null;
        const moleFailed =
          tier === "safe" && scan.mole.status === "failed" ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground" data-testid="mole-failed">
              {t("Mole could not finish its preview, so its cache list is missing. The rest of the scan is unaffected.")}
              {scan.mole.message ? ` (${scan.mole.message})` : ""}
            </p>
          ) : null;
        if (items.length === 0 && !moleRow && !moleFailed && !(tier === "review" && scan.buildDirectoryMissing)) return null;
        return (
          <section key={tier} className="space-y-3" data-testid={`tidy-tier-${tier}`}>
            <TierHeading tier={tier} items={items} selected={selected} onToggleAll={onToggleMany} />
            {groups.map(([group, groupRows]) => (
              <div key={group} className="space-y-1.5">
                {groups.length > 1 || group === "mole" ? (
                  <h3 className="px-1 text-xs font-semibold text-muted-foreground">
                    {t(GROUP_TITLES[group] ?? "Other")}
                    {group === "mole" && scan.mole.status === "found"
                      ? ` · ${t("{ignored} listed paths are outside this app's safe rules and were ignored", { ignored: scan.mole.ignored })}`
                      : ""}
                  </h3>
                ) : null}
                <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs/5">
                  {groupRows.map((item) => (
                    <TidyItemRow key={item.id} item={item} selected={selected.has(item.id)} onToggle={onToggle} nowMs={nowMs} />
                  ))}
                </ul>
              </div>
            ))}
            {moleRow}
            {moleFailed}
            {tier === "review" && scan.buildDirectoryMissing ? settingsHint : null}
          </section>
        );
      })}
      {scan.truncated ? (
        <p className="text-xs text-muted-foreground" role="status">
          {t("The scan stopped at its time limit, so this list may be incomplete. Scan again to continue.")}
        </p>
      ) : null}
      <StorageTidyNotes />
      <ActionBar summary={summary} rescueEnabled={rescueEnabled} busy={busy} onExecute={onExecute} onRescan={onRescan} volume={volume} />
    </div>
  );
}
