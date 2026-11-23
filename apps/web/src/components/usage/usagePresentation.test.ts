import { describe, it, expect } from "vite-plus/test";
import { displayCostRows, cacheInputRate } from "./usagePresentation";
import { PROVIDER_PRESENTATION, providersWithUsage, usageSeries } from "./usageProviders";
import { tokenTypeSegments } from "./usageBreakdown";
import { zhCN } from "~/i18n/catalog";
describe("usage presentation invariants", () => {
  it("keeps cache writes and provider-reported unsplit costs visible without changing the total", () => {
    const tokens = {
      uncachedInputTokens: 20,
      cachedInputTokens: 70,
      cacheCreationTokens: 10,
      outputTokens: 5,
    };
    expect(tokenTypeSegments(tokens).map((s) => s.value)).toEqual([20, 70, 10, 5]);
    expect(cacheInputRate(tokens)).toBe(0.7);
    const rows = displayCostRows(
      { input: 10, output: 20, cacheRead: 30, cacheWrite: 5, unsplit: 12 },
      [
        { provider: "grok", value: 8 },
        { provider: "codex", value: 3 },
      ],
    );
    expect(rows.reduce((sum, r) => sum + r.value, 0)).toBe(77);
    expect(rows.find((r) => r.label.includes("Grok"))).toMatchObject({ value: 8 });
    expect(rows.filter((r) => r.note).map((r) => r.value)).toEqual([8, 3, 1]);
    expect(
      displayCostRows({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, unsplit: 2 }, [
        { provider: "grok", value: 20 },
      ]).reduce((s, r) => s + r.value, 0),
    ).toBe(2);
  });
  it("keeps provider colors stable when ranking changes or another provider is filtered", () => {
    expect(
      providersWithUsage([
        { provider: "grok", costUsd: 500, totalTokens: 0 },
        { provider: "codex", costUsd: 1, totalTokens: 0 },
      ]),
    ).toEqual(["codex", "grok"]);
    expect(PROVIDER_PRESENTATION.codex.color).toBe("var(--usage-codex)");
    expect(PROVIDER_PRESENTATION.grok.color).toBe("var(--usage-grok)");
    expect(["pi", "muse", "opencode", "cursor"].map((p) => usageSeries(p as "pi"))).toEqual([
      "cursor",
      "cursor",
      "cursor",
      "cursor",
    ]);
  });
  it("includes the billing, cache and provider grouping catalog keys", () => {
    expect(zhCN["Estimated at API list prices"]).toBe("按 API 标价估算");
    expect(zhCN["Cache write"]).toBeTruthy();
    expect(zhCN["{provider} total"]).toContain("{provider}");
    expect(zhCN["Other providers"]).toBe("其他提供方");
  });
});
