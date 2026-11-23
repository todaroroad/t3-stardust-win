import { USAGE_CONTRACT_VERSION, type UsageProviderKind } from "@t3tools/contracts";
import { mergeUsage, type EnvironmentUsage } from "@t3tools/shared/usageMerge";
import type { EnvironmentUsageStatus } from "../../state/usage";
import { usageSeries } from "./usageProviders";

export function toggleUsageFilter<T>(current: T | null, picked: T): T | null {
  return current === picked ? null : picked;
}

/** Filter raw buckets before merging so source deduplication and model shares stay correct. */
export function scopeUsageEnvironments(
  environments: readonly EnvironmentUsageStatus[],
  hidden: ReadonlySet<UsageProviderKind>,
  provider: UsageProviderKind | null = null,
  hour: string | null = null,
): readonly EnvironmentUsageStatus[] {
  const keep = (kind: UsageProviderKind) =>
    !hidden.has(kind) && (provider === null || usageSeries(kind) === provider);
  return environments.map((environment) => {
    if (!environment.summary) return environment;
    // Project attribution is window-wide. An hour selection must not reuse window-wide totals.
    const { projectTotals, ...summary } = environment.summary;
    return {
      ...environment,
      summary: {
        ...summary,
        sources: summary.sources.filter((source) => keep(source.fingerprint.provider)),
        buckets: summary.buckets.filter(
          (bucket) => keep(bucket.provider) && (hour === null || bucket.hourStart === hour),
        ),
        ...(hour === null && projectTotals
          ? { projectTotals: projectTotals.filter((row) => keep(row.provider)) }
          : {}),
      },
    };
  });
}

export function mergeUsageEnvironments(environments: readonly EnvironmentUsageStatus[]) {
  const answered: EnvironmentUsage[] = environments.flatMap(({ environmentId, label, summary }) =>
    summary ? [{ environmentId, label, summary }] : [],
  );
  return mergeUsage(answered, USAGE_CONTRACT_VERSION);
}

export function tokenPeriodTotals(
  environments: readonly EnvironmentUsageStatus[],
  periods: readonly string[],
  hourly: boolean,
) {
  return periods.map((period) =>
    mergeUsageEnvironments(
      environments.map((environment) =>
        environment.summary
          ? {
              ...environment,
              summary: {
                ...environment.summary,
                buckets: environment.summary.buckets.filter((bucket) =>
                  hourly ? bucket.hourStart === period : bucket.day === period,
                ),
                projectTotals: [],
              },
            }
          : environment,
      ),
    ),
  );
}

export function modelBarGeometry(count: number) {
  const step = 456 / Math.max(1, count);
  const gap = Math.min(4, step * 0.22);
  return { step, width: step - gap };
}
