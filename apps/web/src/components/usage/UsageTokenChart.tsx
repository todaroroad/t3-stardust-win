import { uiText as copy } from "~/i18n";
import { usageHourTicks } from "./usageAxis";
import { useState } from "react";
import type { MergedUsage } from "@t3tools/shared/usageMerge";
import { formatPercent, formatTokens } from "@t3tools/shared/usageFormat";

export function UsageTokenChart({
  periods,
  totals,
  formatPeriod,
  selectedHour,
  onSelectHour,
  hourly,
  timeZone,
}: {
  readonly periods: readonly string[];
  readonly totals: readonly MergedUsage[];
  readonly formatPeriod: (period: string) => string;
  readonly selectedHour: string | null;
  readonly onSelectHour: (period: string) => void;
  readonly hourly: boolean;
  readonly timeZone?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const peak = Math.max(1, ...totals.map((row) => row.totalTokens));
  const active = hovered === null ? null : totals[periods.indexOf(hovered)];

  const parts = active
    ? ([
        [copy("Cache read"), active.cachedInputTokens],
        [copy("New input"), active.uncachedInputTokens],
        [copy("Output"), active.outputTokens],
        [copy("Cache write"), active.cacheCreationTokens],
      ] as const)
    : [];
  return (
    <div className="usage-token-chart">
      <div className="usage-readout" role="status" data-usage-readout>
        <div>
          <span>{hovered ? formatPeriod(hovered) : copy("All periods · Total")}</span>
          <strong>
            {formatTokens(
              active?.totalTokens ?? totals.reduce((sum, row) => sum + row.totalTokens, 0),
            )}{" "}
            {copy("Tokens")}
          </strong>
        </div>
        <div className="usage-readout-parts">
          {parts
            .filter(([, value]) => value > 0)
            .map(([label, value]) => (
              <span key={label}>
                <b>
                  {formatTokens(value)} ·{" "}
                  {formatPercent(active && active.totalTokens > 0 ? value / active.totalTokens : 0)}
                </b>{" "}
                {label}
              </span>
            ))}
        </div>
      </div>
      <div className="usage-token-plot" onMouseLeave={() => setHovered(null)}>
        <div className="usage-token-axis" aria-hidden>
          {[1, 0.75, 0.5, 0.25, 0].map((value) => (
            <span key={value}>{formatTokens(peak * value)}</span>
          ))}
        </div>
        <div
          className="usage-token-columns"
          role="group"
          aria-label={hourly ? copy("Hourly tokens") : copy("Daily tokens.")}
        >
          {periods.map((period, index) => {
            const row = totals[index];
            const total = row?.totalTokens ?? 0;
            // V9 three layers: cache reads, fresh input (incl. cache writes), model output.
            const cached = Math.min(total, row?.cachedInputTokens ?? 0);
            const output = Math.min(total - cached, row?.outputTokens ?? 0);
            const fresh = Math.max(0, total - cached - output);
            return (
              <button
                type="button"
                key={period}
                className="usage-token-column"
                aria-label={copy("{period}, {count} tokens", {
                  period: formatPeriod(period),
                  count: formatTokens(total),
                })}
                aria-pressed={hourly ? selectedHour === period : undefined}
                data-hovered={hovered === period || undefined}
                onMouseEnter={() => setHovered(period)}
                onFocus={() => setHovered(period)}
                onBlur={() => setHovered(null)}
                onClick={() => {
                  if (hourly) onSelectHour(period);
                }}
              >
                {hovered === period ? <i className="usage-token-rule" /> : null}
                <span
                  data-usage-bar
                  className="usage-token-stack"
                  style={{ height: `${(total / peak) * 100}%` }}
                >
                  <i
                    data-token-type="cache"
                    style={{ height: `${total > 0 ? (cached / total) * 100 : 0}%` }}
                  />
                  <i
                    data-token-type="fresh"
                    style={{ height: `${total > 0 ? (fresh / total) * 100 : 0}%` }}
                  />
                  <i
                    data-token-type="output"
                    style={{ height: `${total > 0 ? (output / total) * 100 : 0}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="usage-token-labels" aria-hidden>
        {hourly && timeZone
          ? usageHourTicks(periods, timeZone, 4, true).map((tick) => (
              <span
                key={tick.at}
                style={{
                  position: "absolute",
                  left: `${tick.position * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {tick.label}
              </span>
            ))
          : periods
              .filter((_, index) => index % Math.max(1, Math.floor(periods.length / 6)) === 0)
              .map((period) => (
                <span key={period}>
                  {hourly ? formatPeriod(period).replace(/:\d{2}$/, ":00") : formatPeriod(period)}
                </span>
              ))}
      </div>
      <div className="usage-token-legend">
        <span>
          <i />
          {copy("Cache read")}
        </span>
        <span>
          <i data-token-type="fresh" />
          {copy("Fresh input (incl. cache writes)")}
        </span>
        <span>
          <i data-token-type="output" />
          {copy("Model output (incl. reasoning)")}
        </span>
      </div>
      {hourly ? (
        <p className="usage-card-hint">
          {copy("Select a bar to filter models to that hour. Select it again to clear.")}
        </p>
      ) : null}
    </div>
  );
}
