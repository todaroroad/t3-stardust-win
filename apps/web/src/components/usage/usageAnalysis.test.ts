import { EnvironmentId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";
import { analysisFixture, analysisHours } from "./usageAnalysis.fixture";
import {
  scopeUsageEnvironments,
  mergeUsageEnvironments,
  toggleUsageFilter,
  tokenPeriodTotals,
  modelBarGeometry,
} from "./usageAnalysis";

it("toggles a provider off and filters totals, model shares, chart buckets, sources and projects together", () => {
  const environments = analysisFixture();
  const all = mergeUsageEnvironments(environments);
  const selected = toggleUsageFilter(null, "codex" as const);
  const filtered = mergeUsageEnvironments(
    scopeUsageEnvironments(environments, new Set(), selected),
  );
  expect(filtered.costUsd).toBe(3);
  expect(filtered.sessions).toBe(2);
  expect(filtered.models.map((model) => model.provider)).toEqual(["codex", "codex"]);
  expect(filtered.models.reduce((sum, model) => sum + model.tokenShare, 0)).toBe(1);
  expect(filtered.hourly.map((row) => row.costUsd)).toEqual([1, 2]);
  expect(filtered.projects.reduce((sum, row) => sum + row.costUsd, 0)).toBe(3);
  expect(
    mergeUsageEnvironments(
      scopeUsageEnvironments(environments, new Set(), toggleUsageFilter(selected, "codex")),
    ),
  ).toEqual(all);
});
it("filters the actual hour boundary, cancels it, and never reuses full-window project attribution", () => {
  const environments = scopeUsageEnvironments(analysisFixture(), new Set(), "codex");
  const hour = toggleUsageFilter(null, analysisHours[0]!);
  const filtered = mergeUsageEnvironments(
    scopeUsageEnvironments(environments, new Set(), null, hour),
  );
  expect(filtered.models.map((model) => model.model)).toEqual(["codex-0"]);
  expect(filtered.totalTokens).toBe(1000);
  expect(filtered.projects.every((row) => row.kind === "unreported")).toBe(true);
  expect(
    mergeUsageEnvironments(
      scopeUsageEnvironments(
        environments,
        new Set(),
        null,
        toggleUsageFilter(hour, analysisHours[0]!),
      ),
    ).models,
  ).toHaveLength(2);
});
it("uses real per-type tokens once across duplicate sources, retaining true zero buckets and reasoning as a subset", () => {
  const environments = analysisFixture();
  const duplicate = {
    ...environments[0]!,
    environmentId: EnvironmentId.make("duplicate"),
    summary: {
      ...environments[0]!.summary!,
      sources: environments[0]!.summary!.sources.map((source) => ({
        ...source,
        fingerprint: { ...source.fingerprint },
      })),
    },
  };
  const periods = [...analysisHours, "2026-11-16T15:52:00.000Z"];
  const totals = tokenPeriodTotals([...environments, duplicate], periods, true);
  expect(totals.map((row) => row.totalTokens)).toEqual([2100, 3700, 0]);
  expect(totals[0]).toMatchObject({
    cachedInputTokens: 1600,
    uncachedInputTokens: 300,
    outputTokens: 140,
    cacheCreationTokens: 60,
    reasoningTokens: 40,
  });
  expect(modelBarGeometry(90).width / modelBarGeometry(90).step).toBeCloseTo(0.78);
});
