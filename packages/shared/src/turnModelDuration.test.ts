import { describe, expect, it } from "vite-plus/test";

import {
  MIN_THROUGHPUT_MODEL_MS,
  computeTurnModelDuration,
  evaluateThroughputTurn,
  unionIntervalLength,
} from "./turnModelDuration.ts";

describe("turnModelDuration", () => {
  it("merges overlapping tool intervals without double-counting parallel tools", () => {
    expect(
      unionIntervalLength([
        [10_000, 40_000],
        [30_000, 50_000],
        [60_000, 65_000],
      ]),
    ).toBe(45_000);
  });

  it("clips tool intervals to the owning turn so background commands cannot swallow model time", () => {
    const result = computeTurnModelDuration(10_000, 20_000, [
      [5_000, 12_000],
      [18_000, 90_000],
    ]);
    expect(result).toEqual({
      durationMs: 10_000,
      toolMs: 4_000,
      modelMs: 6_000,
    });
  });

  it("returns null for invalid or non-positive turn windows", () => {
    expect(computeTurnModelDuration(10_000, 10_000, [])).toBeNull();
    expect(computeTurnModelDuration(20_000, 10_000, [])).toBeNull();
    expect(computeTurnModelDuration(Number.NaN, 10_000, [])).toBeNull();
  });

  it("evaluates throughput candidates according to status, usage, localCommand, and 1000ms floor", () => {
    const base = {
      status: "completed",
      startedAtMs: 0,
      completedAtMs: 10_000,
      usageStatus: "complete",
      localCommand: false,
      outputTokens: 600,
      toolIntervals: [[2_000, 6_000]] as const,
    };

    expect(evaluateThroughputTurn(base)).toEqual({ outputTokens: 600, modelMs: 6_000 });
    expect(evaluateThroughputTurn({ ...base, usageStatus: "partial" })).toEqual({
      outputTokens: 600,
      modelMs: 6_000,
    });

    // Exclusions:
    expect(evaluateThroughputTurn({ ...base, status: "running" })).toBeNull();
    expect(evaluateThroughputTurn({ ...base, status: "failed" })).toBeNull();
    expect(evaluateThroughputTurn({ ...base, startedAtMs: null })).toBeNull();
    expect(evaluateThroughputTurn({ ...base, completedAtMs: null })).toBeNull();
    expect(evaluateThroughputTurn({ ...base, usageStatus: "unavailable" })).toBeNull();
    expect(evaluateThroughputTurn({ ...base, usageStatus: undefined })).toBeNull();
    expect(evaluateThroughputTurn({ ...base, localCommand: true })).toBeNull();
    expect(evaluateThroughputTurn({ ...base, outputTokens: undefined })).toBeNull();
    expect(evaluateThroughputTurn({ ...base, outputTokens: Number.NaN })).toBeNull();
    expect(evaluateThroughputTurn({ ...base, outputTokens: -1 })).toBeNull();

    // Model duration < 1000ms after subtracting tools is excluded.
    expect(
      evaluateThroughputTurn({
        ...base,
        startedAtMs: 0,
        completedAtMs: 5_000,
        toolIntervals: [[0, 4_001]],
      }),
    ).toBeNull();

    // Exactly MIN_THROUGHPUT_MODEL_MS (1000ms) is included.
    expect(
      evaluateThroughputTurn({
        ...base,
        startedAtMs: 0,
        completedAtMs: 5_000,
        toolIntervals: [[0, 5_000 - MIN_THROUGHPUT_MODEL_MS]],
      }),
    ).toEqual({ outputTokens: 600, modelMs: 1_000 });
  });
});
