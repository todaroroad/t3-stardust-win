import {
  EnvironmentId,
  UsageDay,
  USAGE_CONTRACT_VERSION,
  type UsageBucket,
  type UsageProviderKind,
} from "@t3tools/contracts";
import type { EnvironmentUsageStatus } from "../../state/usage";

export const analysisHours = ["2026-11-16T13:52:00.000Z", "2026-11-16T14:52:00.000Z"];
export function analysisFixture(): readonly EnvironmentUsageStatus[] {
  const providers: readonly UsageProviderKind[] = ["codex", "claude"];
  const buckets: UsageBucket[] = providers.flatMap((provider, index) =>
    analysisHours.map((hour, slot) => ({
      day: UsageDay.make("2026-11-16"),
      hourStart: hour,
      provider,
      model: `${provider}-${slot}`,
      sourcePath: `/${provider}`,
      totals: {
        uncachedInputTokens: 100 * (index + 1),
        cachedInputTokens: 800 * (slot + 1),
        cacheCreationTokens: 30,
        outputTokens: 70,
        reasoningTokens: 20,
      },
      costUsd: (index + 1) * (slot + 1),
      cacheSavingsUsd: 2,
      costSource: "modelPriced",
      records: 1,
      unpricedRecords: 0,
      sessions: 1,
    })),
  );
  return [
    {
      environmentId: EnvironmentId.make("test"),
      label: "Test",
      isPending: false,
      canReadDiagnostics: true,
      isConnected: true,
      error: null,
      summary: {
        contractVersion: USAGE_CONTRACT_VERSION,
        readAt: "2026-11-16T16:00:00Z",
        timeZone: "UTC",
        sinceDay: UsageDay.make("2026-11-16"),
        untilDay: UsageDay.make("2026-11-16"),
        buckets,
        sources: providers.map((provider) => ({
          fingerprint: {
            hostId: "test",
            provider,
            resolvedHomePath: `/${provider}`,
            volumeId: "test",
          },
          status: "ok",
          scannedFiles: 1,
          skippedFiles: 0,
          malformedRecords: 0,
          distinctSessions: 2,
          message: null,
        })),
        pricing: { status: "fresh", source: "litellm", fetchedAt: null, knownModels: 4 },
        scanDurationMs: 1,
        projectTotals: buckets.map((bucket) => ({
          provider: bucket.provider,
          sourcePath: bucket.sourcePath,
          totals: bucket.totals,
          costUsd: bucket.costUsd,
          records: 1,
          unpricedRecords: 0,
          sessions: 1,
        })),
      },
    },
  ];
}
