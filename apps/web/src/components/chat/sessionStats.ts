import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import { orchestrationV2RunWorkStartedAt } from "@t3tools/contracts";
import { TURN_TOOL_ITEM_TYPES, computeTurnModelDuration } from "@t3tools/shared/usageMerge";
import type { uiText } from "../../i18n";
import { selectWorkingRun, terminalRunStatuses } from "./turnThroughput";
import * as DateTime from "effect/DateTime";

const TOOL_ITEMS = TURN_TOOL_ITEM_TYPES;
const RESPONSE_ITEMS = new Set(["assistant_message", "reasoning", "proposed_plan", ...TOOL_ITEMS]);

type Instant = Parameters<typeof DateTime.toEpochMillis>[0];
const ms = (value: Instant | null | undefined) =>
  value == null ? null : DateTime.toEpochMillis(value);

// Structure arrays are immutable. Metadata-only projection updates keep these three inputs.
const statsCache = new WeakMap<
  ThreadStructure["turnItems"],
  {
    readonly runs: ThreadStructure["runs"];
    readonly providerTurns: ThreadStructure["providerTurns"];
    readonly stats: ReturnType<typeof computeSessionStats>;
  }
>();

export function selectSessionStats(projection: ThreadStructure) {
  const previous = statsCache.get(projection.turnItems);
  if (previous?.runs === projection.runs && previous.providerTurns === projection.providerTurns) {
    return previous.stats;
  }
  const stats = computeSessionStats(projection);
  statsCache.set(projection.turnItems, {
    runs: projection.runs,
    providerTurns: projection.providerTurns,
    stats,
  });
  return stats;
}

/**
 * Whole-conversation statistics from recorded runs, provider turns and timeline items.
 * "First response" is when the assistant's first output appeared; providers do not report
 * per-token timing, so this is not a true time-to-first-token.
 */
function computeSessionStats(projection: ThreadStructure) {
  const turns = projection.runs.filter((run) => terminalRunStatuses.has(run.status)).length;
  const toolItems = projection.turnItems.filter((item) => TOOL_ITEMS.has(item.type));
  const currentRun =
    selectWorkingRun(projection.runs) ??
    projection.runs.reduce<(typeof projection.runs)[number] | undefined>(
      (next, run) =>
        run.status === "queued" && (!next || run.ordinal < next.ordinal) ? run : next,
      undefined,
    );
  let modelMs = 0;
  let toolMs = 0;
  let timedTurns = 0;
  let inputTokens: number | null = null;
  let cachedInputTokens: number | null = null;
  let outputTokens: number | null = null;
  let measuredOutputMs = 0;
  let measuredOutputTokens = 0;
  const firstResponses: number[] = [];
  const firstItemByTurn = new Map<string, number>();
  const toolIntervalsByTurn = new Map<string, Array<readonly [number, number]>>();
  for (const item of toolItems) {
    const start = ms(item.startedAt);
    const end = ms(item.completedAt);
    if (!item.providerTurnId || start === null || end === null) continue;
    const key = String(item.providerTurnId);
    const intervals = toolIntervalsByTurn.get(key) ?? [];
    intervals.push([start, end]);
    toolIntervalsByTurn.set(key, intervals);
  }
  for (const item of projection.turnItems) {
    if (!item.providerTurnId || !RESPONSE_ITEMS.has(item.type)) continue;
    const at = ms(item.startedAt) ?? ("updatedAt" in item ? ms(item.updatedAt) : null);
    if (at === null) continue;
    const key = String(item.providerTurnId);
    firstItemByTurn.set(key, Math.min(firstItemByTurn.get(key) ?? Infinity, at));
  }
  for (const turn of projection.providerTurns) {
    const start = ms(turn.startedAt);
    const end = ms(turn.completedAt);
    const timing =
      start !== null && end !== null
        ? computeTurnModelDuration(start, end, toolIntervalsByTurn.get(String(turn.id)) ?? [])
        : null;
    const duration = timing?.durationMs ?? null;
    if (timing !== null) {
      timedTurns += 1;
      toolMs += timing.toolMs;
      modelMs += timing.modelMs;
    }
    const first = firstItemByTurn.get(String(turn.id));
    if (start !== null && first !== undefined && first >= start) firstResponses.push(first - start);
    const usage = turn.turnTokenUsage;
    if (!usage || usage.usageStatus === "unavailable" || usage.localCommand) continue;
    if (usage.inputTokens !== undefined) inputTokens = (inputTokens ?? 0) + usage.inputTokens;
    if (usage.cachedInputTokens !== undefined)
      cachedInputTokens = (cachedInputTokens ?? 0) + usage.cachedInputTokens;
    if (usage.outputTokens !== undefined) outputTokens = (outputTokens ?? 0) + usage.outputTokens;
    if (duration !== null && typeof usage.outputTokens === "number") {
      measuredOutputMs += duration;
      measuredOutputTokens += usage.outputTokens;
    }
  }
  return {
    runCount: projection.runs.length,
    turns,
    current: currentRun
      ? {
          status: currentRun.status,
          startMs: DateTime.toEpochMillis(orchestrationV2RunWorkStartedAt(currentRun)),
          steps: toolItems.filter((item) => item.runId === currentRun.id).length,
        }
      : null,
    steps: toolItems.length,
    /** Provider turns with both start and end recorded; times are only meaningful when > 0. */
    timedTurns,
    modelMs,
    toolMs,
    toolCalls: toolItems.length,
    firstResponseMs: firstResponses.length
      ? firstResponses.reduce((sum, value) => sum + value, 0) / firstResponses.length
      : null,
    /** End-to-end: output tokens over whole turn time, including thinking, tools and waits. */
    outputRate: measuredOutputMs >= 1000 ? measuredOutputTokens / (measuredOutputMs / 1000) : null,
    usageReported: inputTokens !== null || outputTokens !== null || cachedInputTokens !== null,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    cacheHitRate:
      inputTokens !== null && inputTokens > 0 && cachedInputTokens !== null
        ? Math.min(1, cachedInputTokens / inputTokens)
        : null,
  };
}
export type SessionStats = ReturnType<typeof selectSessionStats>;

export function formatStatDuration(value: number, text: typeof uiText, compact = false) {
  const seconds = Math.floor(Math.max(0, value) / 1000);
  if (seconds < 60) return text("{seconds}s", { seconds });
  const minutes = Math.floor(seconds / 60);
  if (compact) return text("{minutes}m", { minutes });
  if (minutes < 60) return text("{minutes}m {seconds}s", { minutes, seconds: seconds % 60 });
  return text("{hours}h {minutes}m", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

export function formatTokenCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return String(value);
}
