import { useUiText } from "~/i18n/useUiText";

import { formatPercent } from "@t3tools/shared/usageFormat";
import type { ShareSegment } from "./UsageShareBar";
export function UsageTypeRows({
  label,
  rows,
  format,
  hitRate,
}: {
  readonly label: string;
  readonly rows: readonly (ShareSegment & { note?: string | undefined })[];
  readonly format: (n: number) => string;
  readonly hitRate?: number | null;
}) {
  const uiText = useUiText();
  const visible = rows.filter((r) => r.value > 0).toSorted((a, b) => b.value - a.value);
  const max = visible[0]?.value ?? 0;
  const total = visible.reduce((s, r) => s + r.value, 0);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-sm font-semibold">{label}</h3>
      {hitRate !== undefined && hitRate !== null ? (
        <>
          <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            {visible.map((r, i) => (
              <span
                key={r.label}
                className="usage-grow bg-primary"
                style={{ width: `${(r.value / total) * 100}%`, opacity: 1 - i * 0.2 }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {uiText("Cache hit rate {rate}; cache writes count as misses.", {
              rate: formatPercent(hitRate),
            })}
          </p>
        </>
      ) : null}
      {visible.map((r, index) => (
        <div
          key={r.label}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-2 gap-y-1 text-xs"
        >
          <span>{r.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="usage-grow h-full rounded-full bg-primary"
              data-unsplit={Boolean(r.note)}
              style={{
                width: `${(r.value / max) * 100}%`,
                background: `color-mix(in srgb, var(--primary) ${[100, 72, 46, 24][Math.min(index, 3)]}%, var(--card))`,
              }}
            />
          </div>
          <strong className="text-right font-medium tabular-nums">{format(r.value)}</strong>
          {r.note ? (
            <small className="col-span-2 col-start-2 text-muted-foreground">{r.note}</small>
          ) : null}
        </div>
      ))}
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">{uiText("No activity in this window.")}</p>
      ) : null}
    </div>
  );
}
