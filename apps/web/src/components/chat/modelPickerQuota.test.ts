import { testUiLocale } from "../../../test/uiLocale";
import { ProviderDriverKind, type ServerProviderUsageLimits } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  computeModelPickerTags,
  modelPickerQuota as formatQuota,
  resolveModelPickerRowMeta,
} from "./modelPickerQuota";
function modelPickerQuota(limits: ServerProviderUsageLimits | undefined, now: number) {
  return formatQuota({ driver: ProviderDriverKind.make("claudeAgent"), usageLimits: limits }, now);
}
const now = Date.parse("2026-11-05T12:00:00Z");
function limits(usedPercent: number): ServerProviderUsageLimits {
  return {
    checkedAt: new Date(now).toISOString(),
    windows: [
      { id: "session", kind: "session", label: "5h", usedPercent: 99 },
      {
        id: "weekly",
        kind: "weekly",
        label: "Week",
        usedPercent,
        resetsAt: new Date(now + 86400000).toISOString(),
      },
    ],
  };
}
describe("model picker remaining quota", () => {
  it("uses the weekly window, rounds/clamps the remaining value and warns only under 15%", () => {
    using _locale = testUiLocale("zh-CN");
    expect(modelPickerQuota(limits(27), now)).toEqual({ label: "剩 73%", low: false });
    expect(modelPickerQuota(limits(85), now)).toEqual({ label: "剩 15%", low: false });
    expect(modelPickerQuota(limits(86), now)).toEqual({ label: "剩 14%", low: true });
    expect(modelPickerQuota(limits(120), now)).toEqual({ label: "剩 0%", low: true });
    expect(modelPickerQuota(limits(-10), now)).toEqual({ label: "剩 100%", low: false });
  });
  it("hides unknown, stale, failed, unsupported and reset readings", () => {
    using _locale = testUiLocale("zh-CN");
    expect(modelPickerQuota(undefined, now)).toBeNull();
    expect(
      modelPickerQuota({ checkedAt: new Date(now).toISOString(), windows: [] }, now),
    ).toBeNull();
    expect(modelPickerQuota(limits(NaN), now)).toBeNull();
    expect(modelPickerQuota(limits(20), now + 11 * 60000)).toBeNull();
    expect(modelPickerQuota(limits(20), now + 86400000)).toBeNull();
    expect(
      modelPickerQuota(
        { ...limits(20), unavailable: { reason: "probeFailed", message: "failed" } },
        now,
      ),
    ).toBeNull();
    expect(
      modelPickerQuota(
        { ...limits(20), unavailable: { reason: "unsupported", message: "unsupported" } },
        now,
      ),
    ).toBeNull();
  });
});

describe("model picker real-data speed and price tags", () => {
  const models = [
    {
      key: "ag:gemini-4-neon",
      instanceId: "ag",
      driverKind: ProviderDriverKind.make("antigravity"),
      slug: "gemini-4-neon",
    },
    {
      key: "ag:gemini-3.8-flash",
      instanceId: "ag",
      driverKind: ProviderDriverKind.make("antigravity"),
      slug: "gemini-3.8-flash",
    },
    {
      key: "claude:claude-opus-4-6",
      instanceId: "claude",
      driverKind: ProviderDriverKind.make("claudeAgent"),
      slug: "claude-opus-4-6[1m]",
    },
    {
      key: "claude:claude-haiku-4-5",
      instanceId: "claude",
      driverKind: ProviderDriverKind.make("claudeAgent"),
      slug: "claude-haiku-4-5",
    },
    {
      key: "codex:gpt-5.4",
      instanceId: "codex",
      driverKind: ProviderDriverKind.make("codex"),
      slug: "gpt-5.4",
    },
  ];

  it("tags the cheapest model per provider (>=2 comparable) and the #1 fastest model (>=5 turns)", () => {
    const tags = computeModelPickerTags({
      models,
      modelUnitPrices: {
        "gemini-4-neon": 0.00000725,
        "gemini-3.8-flash": 0.00000145,
        "claude-opus-4-6": 0.000027,
        "claude-haiku-4-5": 0.000005,
        // Single comparable model for codex must NOT be tagged Low-cost.
        "gpt-5.4": 0.000001,
      },
      throughput: [
        { provider: "antigravity", model: "gemini-3.8-flash", turns: 8, tokensPerSecond: 142 },
        { provider: "claude", model: "claude-haiku-4-5", turns: 12, tokensPerSecond: 98 },
        // Higher rate but <5 turns: ineligible for Ultrafast.
        { provider: "codex", model: "gpt-5.4", turns: 4, tokensPerSecond: 210 },
      ],
    });

    expect(tags.get("ag:gemini-3.8-flash")).toEqual({ isFastest: true, isLowPrice: true });
    expect(tags.get("ag:gemini-4-neon")).toBeUndefined();
    expect(tags.get("claude:claude-haiku-4-5")).toEqual({ isFastest: false, isLowPrice: true });
    expect(tags.get("claude:claude-opus-4-6")).toBeUndefined();
    expect(tags.get("codex:gpt-5.4")).toBeUndefined();
  });

  it("does not tag Low-cost when all comparable models in a provider share the exact same price", () => {
    const tags = computeModelPickerTags({
      models: models.slice(0, 2),
      modelUnitPrices: {
        "gemini-4-neon": 0.000005,
        "gemini-3.8-flash": 0.000005,
      },
      throughput: [],
    });
    expect(tags.size).toBe(0);
  });

  it("applies V9 priority: low quota (<=20%) always wins, otherwise tag, otherwise quota, otherwise null", () => {
    using _locale = testUiLocale("zh-CN");
    const highQuota = { label: "剩 98%", low: false, remaining: 98 };
    const borderQuota = { label: "剩 20%", low: false, remaining: 20 };
    const lowQuota = { label: "剩 5%", low: true, remaining: 5 };

    // Quota <= 20% overrides even Fast & Low-cost.
    expect(
      resolveModelPickerRowMeta({
        quota: lowQuota,
        tag: { isFastest: true, isLowPrice: true },
      }),
    ).toEqual({ label: "剩 5%", low: true });
    expect(
      resolveModelPickerRowMeta({
        quota: borderQuota,
        tag: { isFastest: true, isLowPrice: true },
      }),
    ).toEqual({ label: "剩 20%", low: false });

    // Healthy quota (>20%) lets earned tags show (matching V9 Gemini 3.8 Flash).
    expect(
      resolveModelPickerRowMeta({
        quota: highQuota,
        tag: { isFastest: true, isLowPrice: true },
      }),
    ).toEqual({ label: "极速低价", low: false });
    expect(
      resolveModelPickerRowMeta({
        quota: highQuota,
        tag: { isFastest: true, isLowPrice: false },
      }),
    ).toEqual({ label: "极速", low: false });
    expect(
      resolveModelPickerRowMeta({
        quota: highQuota,
        tag: { isFastest: false, isLowPrice: true },
      }),
    ).toEqual({ label: "低价", low: false });

    // No tag falls back to remaining quota; neither returns null.
    expect(resolveModelPickerRowMeta({ quota: highQuota, tag: undefined })).toEqual({
      label: "剩 98%",
      low: false,
    });
    expect(resolveModelPickerRowMeta({ quota: null, tag: undefined })).toBeNull();
  });
});
