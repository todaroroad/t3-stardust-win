import { describe, expect, it } from "vite-plus/test";
import {
  gapParts,
  type PoolHealth,
  pooledRemaining,
  resetAdvice,
  resetPreviewOutcome,
  groupByProvider,
  sortPoolsByRemaining,
  summarizeHealth,
  windowTone,
} from "./limitsHealthModel";

const pool = (patch: Partial<PoolHealth>): PoolHealth => ({
  id: "p",
  driver: "codex",
  label: "Codex",
  lowest: 50,
  state: "ample",
  tone: "ok",
  runsOutToday: false,
  gapMs: null,
  gapRunOutAt: null,
  gapResetAt: null,
  plans: [],
  credits: null,
  redeemable: false,
  ...patch,
});

describe("limits health", () => {
  it("counts pools needing attention apart from pools that last until reset", () => {
    const summary = summarizeHealth([
      pool({ id: "a", tone: "bad", gapMs: 3_600_000 }),
      pool({ id: "b", tone: "warn" }),
      pool({ id: "c", tone: "ok" }),
      pool({ id: "d", tone: "ok" }),
    ]);
    expect(summary).toEqual({ total: 4, attention: 2, lasting: 2, anyGap: true });
  });

  it("leaves pools without a fresh reading out of both groups", () => {
    const summary = summarizeHealth([pool({ tone: null, lowest: null }), pool({ tone: "ok" })]);
    expect(summary).toMatchObject({ total: 2, attention: 0, lasting: 1 });
  });

  it("rounds gaps to days from a day up, else to at least one hour", () => {
    expect(gapParts(2.4 * 86_400_000)).toEqual({ unit: "day", count: 2 });
    expect(gapParts(5.6 * 3_600_000)).toEqual({ unit: "hour", count: 6 });
    expect(gapParts(60_000)).toEqual({ unit: "hour", count: 1 });
  });

  it("averages each pool's lowest reading and skips pools without one", () => {
    expect(pooledRemaining([pool({ lowest: 98 }), pool({ lowest: 45 }), pool({ lowest: 5 })])).toBe(
      49,
    );
    expect(pooledRemaining([pool({ lowest: null })])).toBeNull();
  });

  it("recommends the soonest-expiring weekly card when there is a dry gap", () => {
    const now = Date.parse("2026-11-20T10:00:00Z");
    const day = 86_400_000;
    const advice = resetAdvice({
      now,
      gapMs: 2.1 * day,
      remaining: 5,
      cards: [
        { key: "wk-late", scope: "weekly", expiresAt: now + 18 * day, count: 1 },
        { key: "wk-soon", scope: "weekly", expiresAt: now + 2 * day, count: 1 },
        { key: "5h", scope: "session", expiresAt: now + 5 * day, count: 1 },
      ],
    });
    expect(advice.kind).toBe("gap");
    expect(advice.bestKey).toBe("wk-soon");
    expect(advice.soonestDays).toBe(2);
  });

  it("warns about expiring cards when healthy without a gap, and stays calm otherwise", () => {
    const now = Date.parse("2026-11-20T10:00:00Z");
    const day = 86_400_000;
    expect(
      resetAdvice({
        now,
        gapMs: null,
        remaining: 45,
        cards: [{ key: "wk", scope: "weekly", expiresAt: now + 3 * day, count: 1 }],
      }),
    ).toMatchObject({ kind: "expiring", bestKey: "wk", soonestDays: 3 });
    expect(
      resetAdvice({
        now,
        gapMs: null,
        remaining: 45,
        cards: [
          { key: "wk", scope: "weekly", expiresAt: now + 10 * day, count: 1 },
          { key: "5h", scope: "session", expiresAt: now + 4 * day, count: 1 },
        ],
      }),
    ).toMatchObject({ kind: "calm", bestKey: "5h" });
  });

  it("classifies preview outcomes for weekly vs session reset cards", () => {
    const day = 86_400_000;
    expect(resetPreviewOutcome("weekly", 2 * day)).toMatchObject({
      kind: "weekly-gap",
      fillsGap: true,
    });
    expect(resetPreviewOutcome("session", 2 * day)).toMatchObject({
      kind: "session-gap",
      fillsGap: false,
    });
    expect(resetPreviewOutcome("weekly", null)).toMatchObject({
      kind: "weekly-clean",
      fillsGap: false,
    });
  });
});

describe("V11 limits order", () => {
  it("puts the most quota left first, unread pools last, ties by soonest reset", () => {
    const pools = [
      pool({ id: "codex", lowest: 4 }),
      pool({ id: "unread", lowest: null }),
      pool({ id: "antigravity", lowest: 93 }),
      pool({ id: "claude-late", lowest: 27, gapResetAt: 2_000 }),
      pool({ id: "claude-soon", lowest: 27.2, gapResetAt: 1_000 }),
      pool({ id: "grok", lowest: 52 }),
    ];
    expect(sortPoolsByRemaining(pools, (entry) => entry).map((entry) => entry.id)).toEqual([
      "antigravity",
      "grok",
      "claude-soon",
      "claude-late",
      "codex",
      "unread",
    ]);
  });
});

describe("V13 window tone", () => {
  const HOUR = 3_600_000;
  const now = Date.parse("2026-11-20T12:00:00Z");
  const window = (usedPercent: number, hoursLeft: number, durationHours = 168) =>
    ({
      id: "w",
      kind: "weekly",
      label: "Weekly",
      usedPercent,
      windowDurationMins: durationHours * 60,
      resetsAt: new Date(now + hoursLeft * HOUR).toISOString(),
    }) as never;

  it("calls 27% left green when the week resets tomorrow", () => {
    expect(windowTone(window(73, 24), now)).toBe("ok");
  });
  it("calls 52% left orange when it is used faster than time passes", () => {
    // 108h of 168h left (64% of the time) but only 52% of the quota.
    expect(windowTone(window(48, 108), now)).toBe("warn");
  });
  it("calls a window red when it is empty or runs dry within a day", () => {
    expect(windowTone(window(100, 13), now)).toBe("bad");
    // 96% used after 108h: projected to run dry in about 4.5h, two days before the reset.
    expect(windowTone(window(96, 60), now)).toBe("bad");
  });
  it("falls back to plain thresholds without a window length", () => {
    const bare = (usedPercent: number) =>
      ({ id: "w", kind: "weekly", label: "Weekly", usedPercent }) as never;
    expect(windowTone(bare(50), now)).toBe("ok");
    expect(windowTone(bare(75), now)).toBe("warn");
    expect(windowTone(bare(90), now)).toBe("bad");
  });
});

describe("V14 provider grouping", () => {
  it("keeps a provider's accounts together at its best account's place", () => {
    const ranked = ["antigravity", "grok", "claude-2", "codex", "claude-1"].map((id) => ({
      id,
      driver: id.startsWith("claude") ? "claudeAgent" : id,
    }));
    expect(groupByProvider(ranked, (pool) => pool.driver).map((pool) => pool.id)).toEqual([
      "antigravity",
      "grok",
      "claude-2",
      "claude-1",
      "codex",
    ]);
  });
});
