import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import { limitPoolId, paceOf, type LimitPool } from "@t3tools/shared/usageLimits";
import {
  quotaForecast,
  quotaForecastState,
  quotaReadingStale,
  t3LimitWindows,
} from "./usageQuotaPresentation";

const DAY = 86_400_000;

/**
 * V13: does this window last until its reset? `ok` keeps pace with time (or resets soon enough),
 * `warn` burns faster than time or will run dry before the reset, `bad` is empty or runs dry
 * within a day. Without a window length to compare against, fall back to plain thresholds.
 */
export type QuotaTone = "ok" | "warn" | "bad";
export function windowTone(window: ServerProviderUsageWindow, now: number): QuotaTone {
  const remaining = 100 - Math.max(0, Math.min(100, window.usedPercent));
  if (remaining <= 0) return "bad";
  const resetAt = Date.parse(window.resetsAt ?? "");
  const { runOutAt } = quotaForecast(window, now);
  const runsOut = runOutAt !== null && Number.isFinite(resetAt) && runOutAt < resetAt;
  if (runsOut && runOutAt - now < DAY) return "bad";
  if (runsOut) return "warn";
  const pace = paceOf(window, now);
  if (pace === null) return remaining <= 15 ? "bad" : remaining <= 30 ? "warn" : "ok";
  return pace === "ahead" ? "warn" : "ok";
}
const TONE_RANK: Record<QuotaTone, number> = { ok: 0, warn: 1, bad: 2 };
export function worstTone(tones: readonly QuotaTone[]): QuotaTone | null {
  return tones.reduce<QuotaTone | null>(
    (worst, tone) => (worst === null || TONE_RANK[tone] > TONE_RANK[worst] ? tone : worst),
    null,
  );
}

/** Drivers whose subscriptions come with reset credits, even while the count is zero. */
const RESET_CREDIT_DRIVERS = new Set(["codex", "claudeAgent"]);

export interface PoolHealth {
  readonly id: string;
  readonly driver: string;
  readonly label: string;
  /** Lowest remaining percent across the pool's windows; null without a reading. */
  readonly lowest: number | null;
  readonly state: "early" | "tight" | "ample" | "unknown";
  /** V13 verdict across fresh readings; null when nothing fresh was read. */
  readonly tone: QuotaTone | null;
  /** Projected to run dry before the end of today (or already dry before its reset). */
  readonly runsOutToday: boolean;
  /** Longest projected stretch without quota before the next reset, in ms. */
  readonly gapMs: number | null;
  /** When the window behind `gapMs` is projected to run dry, and when it naturally resets. */
  readonly gapRunOutAt: number | null;
  readonly gapResetAt: number | null;
  /** Subscription plans reported by the pool's logins, deduplicated. */
  readonly plans: readonly string[];
  /** Reset credits on hand; null when this provider has no reset-credit system. */
  readonly credits: number | null;
  /** Some login here can spend a credit from T3 (opens the reset tray). */
  readonly redeemable: boolean;
}

function endOfDay(now: number): number {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

export function poolHealth(pool: LimitPool, label: string, now: number): PoolHealth {
  const groups = t3LimitWindows(pool);
  const windows = groups.flatMap((group) => group.members.map((member) => member.window));
  const lowest = groups.length ? Math.min(...groups.map((group) => group.remainingPercent)) : null;
  let gapMs: number | null = null;
  let earliestRunOut: number | null = null;
  let gapRunOutAt: number | null = null;
  let gapResetAt: number | null = null;
  const tones: QuotaTone[] = [];
  for (const group of groups) {
    for (const member of group.members) {
      if (quotaReadingStale(member.account.limits, now)) continue;
      tones.push(windowTone(member.window, now));
      const resetAt = Date.parse(member.window.resetsAt ?? "");
      if (!(resetAt > now)) continue;
      const { runOutAt } = quotaForecast(member.window, now);
      if (runOutAt === null || runOutAt >= resetAt) continue;
      const gap = resetAt - Math.max(now, runOutAt);
      if (gapMs === null || gap > gapMs) {
        gapMs = gap;
        gapRunOutAt = Math.max(now, runOutAt);
        gapResetAt = resetAt;
      }
      earliestRunOut = earliestRunOut === null ? runOutAt : Math.min(earliestRunOut, runOutAt);
    }
  }
  const hasSystem =
    RESET_CREDIT_DRIVERS.has(String(pool.driver)) ||
    pool.accounts.some((account) => account.limits.resetCredits !== undefined);
  const credits = hasSystem
    ? pool.accounts.reduce(
        (sum, account) => sum + (account.limits.resetCredits?.availableCount ?? 0),
        0,
      )
    : null;
  return {
    id: limitPoolId(pool),
    driver: String(pool.driver),
    label,
    lowest,
    state: windows.length === 0 ? "unknown" : quotaForecastState(windows, now),
    tone: worstTone(tones),
    runsOutToday: earliestRunOut !== null && earliestRunOut <= endOfDay(now),
    gapMs,
    gapRunOutAt,
    gapResetAt,
    plans: [...new Set(pool.accounts.flatMap((account) => (account.plan ? [account.plan] : [])))],
    credits,
    redeemable: pool.accounts.some(
      (account) =>
        Boolean(account.redeem) && (account.limits.resetCredits?.availableCount ?? 0) > 0,
    ),
  };
}

export interface LimitsHealthSummary {
  readonly total: number;
  /** Pools whose verdict is warn or bad (V13 "needs attention"). */
  readonly attention: number;
  /** Pools that last until their reset. */
  readonly lasting: number;
  readonly anyGap: boolean;
}

export function summarizeHealth(pools: readonly PoolHealth[]): LimitsHealthSummary {
  // Pools without a fresh reading are in neither group; they stay out of the sentence.
  return {
    total: pools.length,
    attention: pools.filter((pool) => pool.tone === "warn" || pool.tone === "bad").length,
    lasting: pools.filter((pool) => pool.tone === "ok").length,
    anyGap: pools.some((pool) => pool.gapMs !== null),
  };
}

/** Rounded gap for chips: whole days from a day up, else whole hours (at least one). */
export function gapParts(ms: number): { readonly unit: "day" | "hour"; readonly count: number } {
  if (ms >= 86_400_000) return { unit: "day", count: Math.round(ms / 86_400_000) };
  return { unit: "hour", count: Math.max(1, Math.round(ms / 3_600_000)) };
}

/** Mean of each pool's lowest remaining percent: the orbit meter's "whole pool" figure. */
export function pooledRemaining(pools: readonly PoolHealth[]): number | null {
  const readings = pools.flatMap((pool) => (pool.lowest === null ? [] : [pool.lowest]));
  if (readings.length === 0) return null;
  return Math.round(readings.reduce((sum, value) => sum + value, 0) / readings.length);
}

const DAY_MS = DAY;

/** Which quota a reset credit refills: the weekly window (also covers a full reset), only the 5-hour window, or something partial. */
export type ResetCardScope = "weekly" | "session" | "other";

export interface ResetCardOption {
  readonly key: string;
  readonly scope: ResetCardScope;
  readonly expiresAt: number | null;
  readonly count: number;
}

export interface ResetAdvice {
  /** `gap`: a dry gap before the natural reset that a weekly card bridges; `expiring`: a card is about to expire; `calm`: no reason to spend one yet. */
  readonly kind: "gap" | "expiring" | "calm";
  readonly bestKey: string | null;
  readonly gapDays: number;
  /** Whole days until the soonest-expiring card, rounded up; null when none reports an expiry. */
  readonly soonestDays: number | null;
  readonly soonestKey: string | null;
}

/**
 * V9 evaluateResetAdvice on live readings: spend the weekly card that expires first when there is a gap
 * before the natural reset; otherwise warn about a card expiring within 3 days; otherwise wait.
 */
export function resetAdvice(input: {
  readonly cards: readonly ResetCardOption[];
  readonly gapMs: number | null;
  readonly remaining: number | null;
  readonly now: number;
}): ResetAdvice {
  const cards = input.cards.filter((card) => card.count > 0);
  const gapDays = (input.gapMs ?? 0) / DAY_MS;
  const byExpiry = (a: ResetCardOption, b: ResetCardOption) =>
    (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity);
  const weekly = cards.filter((card) => card.scope === "weekly").toSorted(byExpiry);
  const session = cards.filter((card) => card.scope === "session").toSorted(byExpiry);
  const soonest = cards.toSorted(byExpiry)[0];
  const soonestDays =
    soonest?.expiresAt == null
      ? null
      : Math.max(0, Math.ceil((soonest.expiresAt - input.now) / DAY_MS));
  const base = { gapDays, soonestDays, soonestKey: soonest?.key ?? null };
  if (gapDays > 0.35 && weekly[0]) return { kind: "gap", bestKey: weekly[0].key, ...base };
  if (soonest && soonestDays !== null && soonestDays <= 3 && (input.remaining ?? 100) < 85)
    return { kind: "expiring", bestKey: soonest.key, ...base };
  return { kind: "calm", bestKey: (session[0] ?? cards[0])?.key ?? null, ...base };
}

/** V9 getPreviewOutcome: whether spending a card of this scope fills the dry gap, and what to say about it. */
export function resetPreviewOutcome(
  scope: ResetCardScope,
  gapMs: number | null,
): {
  readonly kind: "weekly-gap" | "weekly-clean" | "session-gap" | "session-clean" | "other";
  readonly fillsGap: boolean;
  readonly gapDays: number;
} {
  const gapDays = (gapMs ?? 0) / DAY_MS;
  const gap = gapDays > 0.05;
  if (scope === "weekly")
    return { kind: gap ? "weekly-gap" : "weekly-clean", fillsGap: gap, gapDays };
  if (scope === "session")
    return { kind: gap ? "session-gap" : "session-clean", fillsGap: false, gapDays };
  return { kind: "other", fillsGap: false, gapDays };
}

/**
 * V11 order: most quota left first, by each pool's tightest window. Pools without a reading go
 * last; ties keep the soonest natural reset first, then the incoming order (stable sort).
 */
export function sortPoolsByRemaining<T>(
  pools: readonly T[],
  healthOf: (pool: T) => PoolHealth,
): T[] {
  const keyed = pools.map((pool) => {
    const health = healthOf(pool);
    return { pool, lowest: health.lowest, resetAt: health.gapResetAt };
  });
  return keyed
    .toSorted((a, b) => {
      if (a.lowest === null || b.lowest === null) {
        return (a.lowest === null ? 1 : 0) - (b.lowest === null ? 1 : 0);
      }
      if (Math.round(b.lowest) !== Math.round(a.lowest)) return b.lowest - a.lowest;
      return (a.resetAt ?? Infinity) - (b.resetAt ?? Infinity);
    })
    .map((entry) => entry.pool);
}

/**
 * V14: accounts of one provider sit together. Takes an already ranked list; a provider's place is
 * that of its best-ranked account, and its accounts keep their ranked order behind it.
 */
export function groupByProvider<T>(ranked: readonly T[], groupOf: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of ranked) {
    const key = groupOf(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.values()].flat();
}
