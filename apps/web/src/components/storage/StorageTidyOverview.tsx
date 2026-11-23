import type { StorageTidyScan, StorageTidyState, StorageTidyVolume } from "@t3tools/contracts";
import { ShieldCheckIcon } from "lucide-react";

import { useUiText } from "~/i18n/useUiText";
import { cn } from "~/lib/utils";
import { formatBytes } from "../../lib/formatBytes";
import { Badge } from "../ui/badge";
import { Spinner } from "../ui/spinner";
import { StorageTidyDonut, type DonutSegment } from "./StorageTidyDonut";
import { itemsByTier, sumBytes, usedPercent } from "./storageTidyModel";

export const TIER_COLORS = {
  safe: "var(--success)",
  review: "var(--warning)",
  remind: "color-mix(in srgb, var(--muted-foreground) 60%, transparent)",
  used: "color-mix(in srgb, var(--foreground) 82%, transparent)",
} as const;

export function volumeSegments(
  volume: StorageTidyVolume,
  scan: StorageTidyScan | null,
): DonutSegment[] {
  const total = volume.totalBytes ?? 0;
  const used = Math.max(0, total - volume.freeBytes);
  const tiers = itemsByTier(scan);
  const safe = sumBytes(tiers.safe);
  const review = sumBytes(tiers.review);
  const remind = sumBytes(tiers.remind);
  const known = Math.min(used, safe + review + remind);
  const scale = safe + review + remind > 0 ? known / (safe + review + remind) : 0;
  return [
    { id: "safe", value: safe * scale, color: TIER_COLORS.safe },
    { id: "review", value: review * scale, color: TIER_COLORS.review },
    { id: "remind", value: remind * scale, color: TIER_COLORS.remind },
    { id: "used", value: used - known, color: TIER_COLORS.used },
    { id: "free", value: volume.freeBytes, color: "var(--muted)", outline: true },
  ];
}

export function VolumeCards({
  volumes,
  activePath,
  onSelect,
}: {
  readonly volumes: ReadonlyArray<StorageTidyVolume>;
  readonly activePath: string;
  readonly onSelect: (path: string) => void;
}) {
  const t = useUiText();
  return (
    <div className="flex flex-wrap justify-end gap-2.5" role="tablist" aria-label={t("Disks")}>
      {volumes.map((volume) => {
        const percent = usedPercent(volume);
        const active = volume.path === activePath;
        const low = percent !== null && percent >= 95;
        return (
          <button
            key={volume.path}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(volume.path)}
            className={cn(
              "min-w-40 rounded-xl border bg-card px-3.5 py-2.5 text-left shadow-xs/5 transition-colors",
              active ? "border-primary ring-1 ring-primary/40" : "border-border hover:bg-accent/40",
            )}
          >
            <div className="text-sm font-semibold">{volume.name}</div>
            <div className="mt-0.5 text-2xs text-muted-foreground">
              {volume.internal ? t("Internal") : t("External")}
              {percent === null ? "" : ` · ${t("Used {percent}%", { percent })}`}
              {` · ${t("{size} free", { size: formatBytes(volume.freeBytes) })}`}
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", low ? "bg-destructive" : "bg-foreground/70")}
                style={{ width: `${percent ?? 0}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function StorageTidyOverview({
  state,
  volume,
  scanning,
  disabled,
  onScan,
}: {
  readonly state: StorageTidyState;
  readonly volume: StorageTidyVolume | undefined;
  readonly scanning: boolean;
  readonly disabled: boolean;
  readonly onScan: () => void;
}) {
  const t = useUiText();
  if (!volume)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("Disk information is not available yet.")}
      </p>
    );
  const total = volume.totalBytes ?? 0;
  const used = Math.max(0, total - volume.freeBytes);
  const percent = usedPercent(volume);
  const progress = state.progress.total > 0 ? state.progress.checked / state.progress.total : 0;
  const scan = state.scan;
  const tiers = itemsByTier(scan);
  const tierBytes = {
    safe: sumBytes(tiers.safe),
    review: sumBytes(tiers.review),
    remind: sumBytes(tiers.remind),
  };
  const known = Math.min(used, tierBytes.safe + tierBytes.review + tierBytes.remind);
  return (
    <div className="grid items-center gap-x-10 gap-y-6 md:grid-cols-[300px_minmax(0,1fr)]">
      <StorageTidyDonut
        segments={volumeSegments(volume, scan)}
        busy={scanning}
        {...(scanning ? { progress } : {})}
        label={t("Capacity of {name}", { name: volume.name })}
      >
        <button
          type="button"
          className="flex size-30 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/30 outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-64 disabled:hover:scale-100"
          disabled={disabled || scanning}
          onClick={onScan}
        >
          {scanning ? (
            <>
              <Spinner size="lg" />
              <span className="text-xs font-normal">{t("Scanning…")}</span>
            </>
          ) : (
            <>
              <span>{scan ? t("Scan again") : t("Scan")}</span>
              <span className="text-2xs font-normal opacity-80">{t("About 30 seconds")}</span>
            </>
          )}
        </button>
      </StorageTidyDonut>
      <div className="min-w-0 space-y-3.5">
        <p className="text-xs text-muted-foreground">
          {volume.name} · {t("{size} total", { size: formatBytes(total) })}
        </p>
        <p className="text-3xl font-bold tracking-tight tabular-nums">
          {t("{used} used", { used: formatBytes(used) })},{" "}
          <span className="font-semibold text-muted-foreground">
            {t("{free} free", { free: formatBytes(volume.freeBytes) })}
          </span>
        </p>
        {percent !== null && percent >= 80 ? (
          <Badge variant="warning" size="lg">
            {t("Used {percent}%", { percent })}
          </Badge>
        ) : null}
        <ul className="divide-y divide-border/60 text-sm">
          {scan ? (
            <>
              <LegendRow color={TIER_COLORS.safe} name={t("Safe to clean")} value={formatBytes(tierBytes.safe)} ratio={total ? tierBytes.safe / total : 0} />
              <LegendRow color={TIER_COLORS.review} name={t("Take a look")} value={formatBytes(tierBytes.review)} ratio={total ? tierBytes.review / total : 0} />
              <LegendRow color={TIER_COLORS.remind} name={t("Remind only")} value={formatBytes(tierBytes.remind)} ratio={total ? tierBytes.remind / total : 0} />
              <LegendRow color={TIER_COLORS.used} name={t("Other used space")} value={formatBytes(Math.max(0, used - known))} ratio={total ? Math.max(0, used - known) / total : 0} />
            </>
          ) : (
            <LegendRow color={TIER_COLORS.used} name={t("Used")} value={formatBytes(used)} ratio={total ? used / total : 0} />
          )}
          <LegendRow color="var(--muted)" outline name={t("Free")} value={formatBytes(volume.freeBytes)} ratio={total ? volume.freeBytes / total : 0} />
        </ul>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {scan
              ? t("Sizes below were measured by the scan just now. Nothing has been changed yet.")
              : t(
                  "Press Scan to start. Scanning only reads; it never changes a file. You choose what to clean afterwards. Before worktrees and build backups are cleaned, screenshots, previews and uncommitted changes are rescued first.",
                )}
          </span>
        </p>
      </div>
    </div>
  );
}

function LegendRow({
  color,
  name,
  value,
  ratio,
  outline = false,
}: {
  readonly color: string;
  readonly name: string;
  readonly value: string;
  readonly ratio: number;
  readonly outline?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={cn("size-2.5 shrink-0 rounded-sm", outline && "border border-primary")}
        style={outline ? undefined : { backgroundColor: color }}
      />
      <span className="flex-1">{name}</span>
      <span className="tabular-nums text-muted-foreground">{value}</span>
      <span className="h-1 w-28 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-foreground/60"
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </span>
    </li>
  );
}
