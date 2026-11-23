import { uiText } from "../../i18n";
import { useEffect, useState } from "react";
import type { EnvironmentId, UsageSummaryInput } from "@t3tools/contracts";
import type { HourlyTotals, ModelTotals } from "@t3tools/shared/usageMerge";
import { mergeAnsweredUsage, useUsage, type EnvironmentUsageStatus } from "../../state/usage";
import { modelHourlyWindows } from "./usageHourlyWindows";
import { useUsageDateFormat } from "./useUsageDateFormat";

/** Serial reads keep a 90-day detail from launching thirteen concurrent source scans. */
export function UsageBusiestHour({
  days,
  timeZone,
  hour12,
  model,
  environments,
}: {
  readonly days: readonly string[];
  readonly timeZone: string;
  readonly hour12: boolean;
  readonly model: ModelTotals;
  readonly environments: readonly EnvironmentUsageStatus[];
}) {
  const [windows] = useState(() => modelHourlyWindows(days, timeZone));
  const [environmentIds] = useState(
    () => new Set(environments.map((environment) => environment.environmentId)),
  );
  const [reading, setReading] = useState<{
    index: number;
    peak: HourlyTotals | null;
    incomplete: boolean;
  }>({ index: 0, peak: null, incomplete: false });
  const format = useUsageDateFormat();
  const window = windows[reading.index];
  return (
    <>
      {window
        ? uiText("Loading hourly usage…")
        : reading.incomplete
          ? uiText("Incomplete hourly usage")
          : reading.peak
            ? format.formatHourShort(reading.peak.hourStart, timeZone, hour12)
            : uiText("No hourly usage")}
      {window ? (
        <HourlyPeakReader
          key={window.sinceTime}
          window={window}
          environmentIds={environmentIds}
          model={model}
          onReading={(peak, incomplete) =>
            setReading((current) => {
              if (current.index !== reading.index) return current;
              return {
                index: current.index + 1,
                peak:
                  peak && peak.totalTokens > (current.peak?.totalTokens ?? 0) ? peak : current.peak,
                incomplete: current.incomplete || incomplete,
              };
            })
          }
        />
      ) : null}
    </>
  );
}

function HourlyPeakReader({
  window,
  environmentIds,
  model,
  onReading,
}: {
  readonly window: UsageSummaryInput;
  readonly environmentIds: ReadonlySet<EnvironmentId>;
  readonly model: ModelTotals;
  readonly onReading: (peak: HourlyTotals | null, incomplete: boolean) => void;
}) {
  const usage = useUsage(window, environmentIds);
  const settled =
    !usage.isPending &&
    !usage.selectedEnvironments.some((environment) =>
      environment.summary?.sources.some((source) => source.refreshing),
    ) &&
    usage.selectedEnvironments.every(
      (environment) =>
        !environment.isPending && (environment.summary !== null || environment.error !== null),
    );
  const merged = mergeAnsweredUsage(
    usage.selectedEnvironments,
    (bucket) => bucket.model === model.model && bucket.provider === model.provider,
  );
  const peak = merged.hourly.toSorted((a, b) => b.totalTokens - a.totalTokens)[0] ?? null;
  const incomplete =
    usage.isPartial ||
    usage.selectedEnvironments.length !== environmentIds.size ||
    usage.selectedEnvironments.some(
      (environment) => environment.error !== null || environment.summary === null,
    );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- advances the serial read only after the current query settles; the parent rejects duplicate completions
  useEffect(() => {
    if (settled) onReading(peak, incomplete);
  }, [settled, peak, incomplete, onReading]);
  return null;
}
