/**
 * Shared calculation of a provider turn's model generation duration, excluding
 * overlapping tool execution intervals. Used by both server usage throughput
 * aggregation and frontend session statistics so both report identical figures.
 */

export const TURN_TOOL_ITEM_TYPES: ReadonlySet<string> = new Set([
  "command_execution",
  "dynamic_tool",
  "file_change",
  "file_search",
  "web_search",
  "subagent",
]);

/** Minimum model generation duration (ms) for a turn to count toward throughput. */
export const MIN_THROUGHPUT_MODEL_MS = 1000;

export interface TurnModelDuration {
  readonly durationMs: number;
  readonly toolMs: number;
  readonly modelMs: number;
}

/** Total length of possibly overlapping intervals, so parallel tools are not counted twice. */
export function unionIntervalLength(intervals: ReadonlyArray<readonly [number, number]>): number {
  const sorted = intervals
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let start = -Infinity;
  let end = -Infinity;
  for (const [a, b] of sorted) {
    if (a > end) {
      if (end > start) total += end - start;
      start = a;
      end = b;
    } else {
      end = Math.max(end, b);
    }
  }
  if (end > start) total += end - start;
  return total;
}

/**
 * Compute model generation duration for one provider turn:
 * `(turnEndMs - turnStartMs) - union(clipped toolIntervals)`.
 * Tool intervals are clipped to `[turnStartMs, turnEndMs]` so background commands
 * running past turn completion cannot swallow model time.
 */
export function computeTurnModelDuration(
  turnStartMs: number,
  turnEndMs: number,
  toolIntervals: ReadonlyArray<readonly [number, number]>,
): TurnModelDuration | null {
  if (!Number.isFinite(turnStartMs) || !Number.isFinite(turnEndMs) || turnEndMs <= turnStartMs) {
    return null;
  }
  const durationMs = turnEndMs - turnStartMs;
  const clipped: Array<readonly [number, number]> = [];
  for (const [a, b] of toolIntervals) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const start = Math.max(a, turnStartMs);
    const end = Math.min(b, turnEndMs);
    if (end > start) clipped.push([start, end]);
  }
  const toolMs = unionIntervalLength(clipped);
  return {
    durationMs,
    toolMs,
    modelMs: Math.max(0, durationMs - toolMs),
  };
}

export interface ThroughputTurnCandidate {
  readonly status: string;
  readonly startedAtMs: number | null;
  readonly completedAtMs: number | null;
  readonly usageStatus: string | undefined;
  readonly localCommand: boolean | undefined;
  readonly outputTokens: unknown;
  readonly toolIntervals: ReadonlyArray<readonly [number, number]>;
}

/** Qualifies completed turns with usable non-local outputTokens and modelMs >= 1000ms. */
export function evaluateThroughputTurn(
  candidate: ThroughputTurnCandidate,
): { readonly outputTokens: number; readonly modelMs: number } | null {
  if (candidate.status !== "completed") return null;
  if (candidate.startedAtMs === null || candidate.completedAtMs === null) return null;
  if (candidate.usageStatus === undefined || candidate.usageStatus === "unavailable") return null;
  if (candidate.localCommand === true) return null;
  if (
    typeof candidate.outputTokens !== "number" ||
    !Number.isFinite(candidate.outputTokens) ||
    candidate.outputTokens < 0
  ) {
    return null;
  }
  const timing = computeTurnModelDuration(
    candidate.startedAtMs,
    candidate.completedAtMs,
    candidate.toolIntervals,
  );
  if (timing === null || timing.modelMs < MIN_THROUGHPUT_MODEL_MS) return null;
  return {
    outputTokens: Math.round(candidate.outputTokens),
    modelMs: Math.round(timing.modelMs),
  };
}
