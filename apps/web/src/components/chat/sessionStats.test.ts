import { describe, expect, it } from "vite-plus/test";
import * as DateTime from "effect/DateTime";
import type { OrchestrationV2ThreadProjection } from "@t3tools/contracts";
import { uiText } from "../../i18n";
import { formatStatDuration, formatTokenCount, selectSessionStats } from "./sessionStats";

const at = (seconds: number) => DateTime.makeUnsafe(seconds * 1000);
const item = (type: string, turn: string, start: number, end: number | null) => ({
  type,
  providerTurnId: turn,
  startedAt: at(start),
  completedAt: end === null ? null : at(end),
  updatedAt: at(end ?? start),
});

function fixture() {
  return {
    runs: [
      { status: "completed", ordinal: 1 },
      { status: "completed", ordinal: 2 },
      { id: "r3", status: "running", ordinal: 3, startedAt: at(400) },
    ],
    providerTurns: [
      {
        id: "t1",
        startedAt: at(0),
        completedAt: at(100),
        turnTokenUsage: {
          usageStatus: "complete",
          inputTokens: 1000,
          cachedInputTokens: 900,
          outputTokens: 500,
        },
      },
      {
        id: "t2",
        startedAt: at(200),
        completedAt: at(300),
        turnTokenUsage: {
          usageStatus: "complete",
          inputTokens: 1000,
          cachedInputTokens: 700,
          outputTokens: 1500,
        },
      },
      {
        id: "t3",
        startedAt: at(400),
        completedAt: null,
        turnTokenUsage: { usageStatus: "unavailable" },
      },
    ],
    turnItems: [
      item("reasoning", "t1", 2, 5),
      // Two parallel tools overlap for 10s: counted once.
      item("command_execution", "t1", 10, 40),
      item("command_execution", "t1", 30, 50),
      item("assistant_message", "t2", 204, 210),
      item("web_search", "t2", 220, 240),
      item("user_message", "t2", 199, 199),
    ],
  } as unknown as OrchestrationV2ThreadProjection;
}

describe("session stats", () => {
  it("counts the first live run before it has a provider turn or usage", () => {
    const p = fixture();
    const stats = selectSessionStats({
      ...p,
      runs: p.runs.slice(-1),
      providerTurns: [],
      turnItems: [{ ...p.turnItems[0]!, type: "subagent", runId: p.runs.at(-1)!.id } as never],
    });
    expect(stats).toMatchObject({
      runCount: 1,
      turns: 0,
      current: { status: "running", startMs: 400_000, steps: 1 },
      usageReported: false,
      inputTokens: null,
      outputTokens: null,
      timedTurns: 0,
      outputRate: null,
    });
  });

  it("splits model and tool time without double-counting parallel tools", () => {
    const stats = selectSessionStats(fixture());
    expect(stats.turns).toBe(2);
    expect(stats.steps).toBe(3);
    expect(stats.toolMs).toBe(60_000);
    expect(stats.modelMs).toBe(140_000);
  });
  it("reuses totals across projection-only changes and invalidates each statistics input", () => {
    const projection = fixture();
    const stats = selectSessionStats(projection);
    expect(selectSessionStats({ ...projection })).toBe(stats);
    const runs = selectSessionStats({ ...projection, runs: [] });
    expect(runs.turns).toBe(0);
    expect(runs).not.toBe(stats);
    const items = selectSessionStats({ ...projection, turnItems: [] });
    expect(items.steps).toBe(0);
    expect(items).not.toBe(stats);
    const turns = selectSessionStats({ ...projection, providerTurns: [] });
    expect(turns.usageReported).toBe(false);
    expect(turns).not.toBe(stats);
  });
  it("clips tools to their turn so a long background command cannot zero model time", () => {
    const projection = fixture() as unknown as { turnItems: unknown[] };
    projection.turnItems.push(item("command_execution", "t2", 250, 90_000));
    const stats = selectSessionStats(projection as unknown as OrchestrationV2ThreadProjection);
    expect(stats.toolMs).toBe(40_000 + 20_000 + 50_000);
    expect(stats.modelMs).toBe(200_000 - 110_000);
  });
  it("averages first response and end-to-end speed from recorded turns only", () => {
    const stats = selectSessionStats(fixture());
    expect(stats.firstResponseMs).toBe(3_000);
    expect(stats.outputRate).toBe(10);
  });
  it("adds main-agent tokens and computes cache hit from input that includes cache reads", () => {
    const stats = selectSessionStats(fixture());
    expect(stats.inputTokens).toBe(2000);
    expect(stats.cachedInputTokens).toBe(1600);
    expect(stats.outputTokens).toBe(2000);
    expect(stats.cacheHitRate).toBe(0.8);
  });
  it("formats durations and token counts for the stats line", () => {
    expect(formatStatDuration(42_000, uiText)).toBe("42s");
    expect(formatStatDuration(252_000, uiText)).toBe("4m 12s");
    expect(formatTokenCount(1_960_000)).toBe("1.96M");
    expect(formatTokenCount(38_400)).toBe("38.4K");
  });
});
