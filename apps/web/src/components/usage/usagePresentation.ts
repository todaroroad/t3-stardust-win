import type { UsageProviderKind } from "@t3tools/contracts";
import { uiText } from "~/i18n";
import type { EnvironmentUsageStatus } from "~/state/usage";
import { mergeUsage } from "@t3tools/shared/usageMerge";
import { USAGE_CONTRACT_VERSION } from "@t3tools/contracts";
import type { CategoryCost } from "@t3tools/shared/usageMerge";
import { costTypeSegments } from "./usageBreakdown";
import { PROVIDER_PRESENTATION } from "./usageProviders";

export function reportedCostRows(
  environments: readonly EnvironmentUsageStatus[],
  hidden: ReadonlySet<UsageProviderKind>,
) {
  return mergeUsage(
    environments.flatMap(({ environmentId, label, summary }) =>
      summary
        ? [
            {
              environmentId,
              label,
              summary: {
                ...summary,
                buckets: summary.buckets.filter(
                  (bucket) =>
                    !hidden.has(bucket.provider) &&
                    bucket.costSource === "providerReported" &&
                    bucket.categoryCostUsd === undefined,
                ),
              },
            },
          ]
        : [],
    ),
    USAGE_CONTRACT_VERSION,
  )
    .providers.map((row) => ({ provider: row.provider, value: row.costUsd }))
    .filter((row) => row.value > 0);
}
export function displayCostRows(
  cost: CategoryCost,
  reported: readonly { provider: UsageProviderKind; value: number }[],
) {
  const rows = costTypeSegments({ ...cost, unsplit: 0 }).map((row) => ({
    ...row,
    note: undefined as string | undefined,
  }));
  let left = cost.unsplit;
  for (const row of reported) {
    const value = Math.min(left, row.value);
    if (value <= 0) continue;
    rows.push({
      label: uiText("{provider} total", { provider: PROVIDER_PRESENTATION[row.provider].label }),
      value,
      color: "var(--primary)",
      note: uiText("Only the total is reported; no type breakdown is available."),
    });
    left -= value;
  }
  if (left > 0.000001)
    rows.push({
      label: uiText("Unsplit cost"),
      value: left,
      color: "var(--primary)",
      note: uiText("No type breakdown is available."),
    });
  return rows.toSorted((a, b) => b.value - a.value);
}
export function cacheInputRate(tokens: {
  cachedInputTokens: number;
  cacheCreationTokens: number;
  uncachedInputTokens: number;
}) {
  const input = tokens.cachedInputTokens + tokens.cacheCreationTokens + tokens.uncachedInputTokens;
  return input > 0 ? tokens.cachedInputTokens / input : null;
}
