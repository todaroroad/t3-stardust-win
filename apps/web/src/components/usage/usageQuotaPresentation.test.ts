import { testUiLocale } from "../../../test/uiLocale";
import { expect, it } from "vite-plus/test";
import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import {
  quotaForecast,
  quotaForecastState,
  quotaWindowLabel,
  quotaReadingStale,
  quotaReadingLabel,
} from "./usageQuotaPresentation";
const now = Date.parse("2026-11-16T12:00:00Z");
function window(usedPercent: number, elapsed: number): ServerProviderUsageWindow {
  return {
    id: "weekly",
    kind: "weekly",
    label: "Weekly",
    usedPercent,
    windowDurationMins: 1000,
    resetsAt: new Date(now + (1 - elapsed) * 1000 * 60000).toISOString(),
  };
}
it("uses forecast and remaining quota, with no prediction during the first twelve percent", () => {
  using _locale = testUiLocale("zh-CN");
  expect(quotaForecastState([window(51, 0.24)], now)).toBe("early");
  expect(quotaForecastState([window(40, 0.8)], now)).toBe("ample");
  expect(quotaForecastState([window(74, 0.8)], now)).toBe("tight");
  expect(quotaForecastState([window(20, 0.1)], now)).toBe("ample");
  expect(quotaForecastState([window(91, 0.95)], now)).toBe("early");
});
it("translates compound quota windows without losing the model name", () => {
  using _locale = testUiLocale("zh-CN");
  expect(quotaWindowLabel("Weekly · Fable", true)).toBe("本周 · Fable");
  expect(quotaWindowLabel("Gemini · 5-hour", true)).toBe("Gemini · 5 小时");
  expect(quotaWindowLabel("Claude & GPT (shared) · Weekly", true)).toBe("Claude/GPT 共用 · 本周");
});

it("rejects stale, missing and failed readings before forecasting", () => {
  using _locale = testUiLocale("zh-CN");
  const current = { checkedAt: new Date(now).toISOString(), windows: [] };
  expect(quotaReadingStale(current, now)).toBe(false);
  expect(quotaReadingStale(current, now + 600_001)).toBe(true);
  expect(quotaReadingStale({ ...current, unavailable: { reason: "probeFailed" } }, now)).toBe(true);
  expect(quotaReadingStale(current, now, false)).toBe(true);
  expect(quotaReadingStale(undefined, now)).toBe(true);
  expect(quotaReadingLabel(current)).toMatch(/^上次读数 \d{2}:\d{2} · 暂不预测$/);
});

it("uses exact elapsed time for one consistent run-out instant, including fractional percentages", () => {
  using _locale = testUiLocale("zh-CN");
  const reading = window(80, 0.1837);
  const forecast = quotaForecast(reading, now);
  expect(forecast.elapsed).toBeCloseTo(0.1837, 12);
  expect(forecast.runOutAt).toBeCloseTo(now + 20 / (80 / (0.1837 * 1000 * 60_000)), 0);
  expect(forecast.projected).toBeCloseTo(80 / 0.1837, 10);
  expect(quotaForecast(window(20, 0.12), now).runOutAt).toBeNull();
  expect(
    quotaForecast({ ...reading, resetsAt: new Date(now).toISOString() }, now).runOutAt,
  ).toBeNull();
  expect(quotaForecast({ ...reading, windowDurationMins: undefined }, now).runOutAt).toBeNull();
});
