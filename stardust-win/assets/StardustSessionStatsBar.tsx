import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import { orchestrationV2RunWorkStartedAt, type OrchestrationV2RunStatus } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { useLocale } from "gt-react";
import { memo, useEffect, useState } from "react";

import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "../ui/popover";

const TOOL_ITEMS = new Set<string>([
  "command_execution",
  "file_change",
  "file_search",
  "web_search",
  "subagent",
  "dynamic_tool",
  "mcp_tool_call",
]);

function computeTurnModelDuration(
  turnStartMs: number,
  turnEndMs: number,
  intervals: ReadonlyArray<readonly [number, number]>,
) {
  const durationMs = Math.max(0, turnEndMs - turnStartMs);
  if (durationMs === 0 || intervals.length === 0) {
    return { durationMs, toolMs: 0, modelMs: durationMs };
  }
  const clamped = intervals
    .map(([s, e]) => [Math.max(turnStartMs, s), Math.min(turnEndMs, e)] as const)
    .filter(([s, e]) => e > s)
    .toSorted((a, b) => a[0] - b[0]);
  let toolMs = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of clamped) {
    if (curStart < 0) {
      curStart = s;
      curEnd = e;
    } else if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      toolMs += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  if (curStart >= 0) toolMs += curEnd - curStart;
  toolMs = Math.min(durationMs, toolMs);
  return { durationMs, toolMs, modelMs: Math.max(0, durationMs - toolMs) };
}

const RESPONSE_ITEMS = new Set(["assistant_message", "reasoning", "proposed_plan", ...TOOL_ITEMS]);
const TERMINAL_STATUSES = new Set<OrchestrationV2RunStatus>([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);
const ACTIVE_STATUSES = new Set<OrchestrationV2RunStatus>([
  "preparing",
  "starting",
  "running",
  "waiting",
]);

type Instant = Parameters<typeof DateTime.toEpochMillis>[0];
const toMs = (value: Instant | null | undefined) =>
  value == null ? null : DateTime.toEpochMillis(value);

const statsCache = new WeakMap<
  ThreadStructure["turnItems"],
  {
    readonly runs: ThreadStructure["runs"];
    readonly providerTurns: ThreadStructure["providerTurns"];
    readonly stats: ReturnType<typeof computeSessionStats>;
  }
>();

function selectSessionStats(projection: ThreadStructure) {
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

function computeSessionStats(projection: ThreadStructure) {
  const turns = projection.runs.filter((run) => TERMINAL_STATUSES.has(run.status)).length;
  const toolItems = projection.turnItems.filter((item) => TOOL_ITEMS.has(item.type));
  const workingRun = projection.runs.findLast((run) => ACTIVE_STATUSES.has(run.status));
  const currentRun =
    workingRun ??
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
    const start = toMs(item.startedAt);
    const end = toMs(item.completedAt);
    if (!item.providerTurnId || start === null || end === null) continue;
    const key = String(item.providerTurnId);
    const intervals = toolIntervalsByTurn.get(key) ?? [];
    intervals.push([start, end]);
    toolIntervalsByTurn.set(key, intervals);
  }
  for (const item of projection.turnItems) {
    if (!item.providerTurnId || !RESPONSE_ITEMS.has(item.type)) continue;
    const at = toMs(item.startedAt) ?? ("updatedAt" in item ? toMs(item.updatedAt) : null);
    if (at === null) continue;
    const key = String(item.providerTurnId);
    firstItemByTurn.set(key, Math.min(firstItemByTurn.get(key) ?? Infinity, at));
  }
  for (const turn of projection.providerTurns) {
    const start = toMs(turn.startedAt);
    const end = toMs(turn.completedAt);
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
    if (start !== null && first !== undefined && first >= start) {
      firstResponses.push(first - start);
    }
    const usage = turn.turnTokenUsage;
    if (!usage || usage.usageStatus === "unavailable" || usage.localCommand) continue;
    if (usage.inputTokens !== undefined) inputTokens = (inputTokens ?? 0) + usage.inputTokens;
    if (usage.cachedInputTokens !== undefined) {
      cachedInputTokens = (cachedInputTokens ?? 0) + usage.cachedInputTokens;
    }
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
    timedTurns,
    modelMs,
    toolMs,
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

function formatTokenCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return String(Math.round(value));
}

function formatStatDuration(ms: number, isZh: boolean, compact = false) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  if (seconds < 60) return isZh ? `${seconds}秒` : `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (compact) return isZh ? `${minutes}分` : `${minutes}m`;
  if (minutes < 60) {
    const rem = seconds % 60;
    return isZh
      ? rem > 0
        ? `${minutes}分${rem}秒`
        : `${minutes}分`
      : rem > 0
        ? `${minutes}m ${rem}s`
        : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  return isZh ? `${hours}时${remMins}分` : `${hours}h ${remMins}m`;
}

export const StardustSessionStatsBar = memo(function StardustSessionStatsBar({
  projection,
  disconnected,
}: {
  readonly projection: ThreadStructure | null | undefined;
  readonly disconnected?: boolean | undefined;
}) {
  const locale = useLocale();
  const isZh = locale.startsWith("zh");
  const [open, setOpen] = useState(false);

  const stats = projection ? selectSessionStats(projection) : null;
  const current = stats?.current ?? null;
  const isTicking = current !== null && !disconnected;
  const [now, setNow] = useState(() => Date.now());

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- 1s elapsed timer while a turn is actively running
  useEffect(() => {
    if (!isTicking) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isTicking]);

  if (!stats || (stats.runCount === 0 && !stats.usageReported)) return null;

  const notRecorded = isZh ? "未记录" : "Not recorded";
  const notReported = isZh ? "未上报" : "Not reported";
  const rateNumber = stats.outputRate === null ? null : Math.round(stats.outputRate);
  const rateText =
    rateNumber === null ? null : isZh ? `${rateNumber} 令牌/秒` : `${rateNumber} tok/s`;
  const roundsText = isZh
    ? `${stats.turns} 轮`
    : stats.turns === 1
      ? "1 round"
      : `${stats.turns} rounds`;
  const stepsText = (count: number) =>
    isZh ? `${count} 步` : count === 1 ? "1 step" : `${count} steps`;

  const total = (stats.inputTokens ?? 0) + (stats.outputTokens ?? 0);
  const totalText =
    stats.inputTokens === null && stats.outputTokens === null
      ? notReported
      : formatTokenCount(total);
  const cacheHitPercent = stats.cacheHitRate === null ? null : Math.round(stats.cacheHitRate * 100);
  const cacheCompact =
    cacheHitPercent === null ? null : isZh ? `缓存 ${cacheHitPercent}%` : `Cache ${cacheHitPercent}%`;
  const busyMs = stats.modelMs + stats.toolMs;
  const modelShare = stats.timedTurns > 0 && busyMs > 0 ? stats.modelMs / busyMs : null;
  const modelPct = modelShare === null ? null : Math.round(modelShare * 100);
  const toolPct = modelPct === null ? null : 100 - modelPct;
  const cachedReadText =
    stats.cachedInputTokens === null ? notReported : formatTokenCount(stats.cachedInputTokens);

  const runStatusLabel = (status: OrchestrationV2RunStatus) => {
    if (disconnected) return isZh ? "连接中断" : "Disconnected";
    switch (status) {
      case "preparing":
        return isZh ? "准备中" : "Preparing";
      case "starting":
        return isZh ? "连接模型" : "Starting";
      case "queued":
        return isZh ? "排队中" : "Queued";
      case "waiting":
        return isZh ? "等待中" : "Waiting";
      default:
        return isZh ? "进行中" : "Running";
    }
  };

  const sessionSummary =
    current === null
      ? [`${roundsText} ${stepsText(stats.steps)}`, rateText].filter(Boolean).join(" · ")
      : [
          isZh ? `第 ${stats.turns + 1} 轮` : `Round ${stats.turns + 1}`,
          runStatusLabel(current.status),
          stepsText(current.steps),
          formatStatDuration(now - current.startMs, isZh, true),
        ].join(" · ");

  const tokenSummary = stats.usageReported
    ? [
        stats.inputTokens === null && stats.outputTokens === null
          ? null
          : isZh
            ? `${formatTokenCount(total)} 令牌`
            : `${formatTokenCount(total)} tok`,
        cacheCompact,
      ]
        .filter(Boolean)
        .join(" · ")
    : current !== null
      ? isZh
        ? "本轮结束后统计"
        : "Reported after turn"
      : "";

  const unifiedSummary = [sessionSummary, tokenSummary].filter(Boolean).join(" · ");

  return (
    <div
      data-t3m-stats-bar
      className="pointer-events-auto flex items-center justify-center pt-1.5 select-none"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              data-t3m-stats-trig="unified"
              className="inline-flex h-6.5 max-w-full cursor-pointer items-center gap-2 rounded-full border border-border/55 bg-background/78 px-3 text-[11.5px] leading-none font-medium whitespace-nowrap text-muted-foreground shadow-xs backdrop-blur-md transition-[color,background-color,border-color,transform] duration-150 hover:border-border hover:bg-muted/55 hover:text-foreground active:scale-[0.985] data-[popup-open]:border-border data-[popup-open]:bg-muted/70 data-[popup-open]:text-foreground"
            />
          }
        >
          <span
            aria-hidden="true"
            className={
              current !== null
                ? "size-1.5 shrink-0 animate-pulse rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.85)]"
                : "size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.75)]"
            }
          />
          <span className="truncate tabular-nums">{unifiedSummary}</span>
        </PopoverTrigger>

        <PopoverPopup side="top" align="center" sideOffset={10} className="w-82 rounded-2xl p-4">
          <div className="space-y-3.5 text-xs">
            {/* Section 1: Session Overview */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <PopoverTitle className="text-[13px] font-semibold text-foreground">
                  {isZh ? "会话概览" : "Session overview"}
                </PopoverTitle>
                <span className="inline-flex h-5 items-center rounded-full bg-emerald-500/15 px-2 text-[11px] font-semibold text-emerald-400 tabular-nums">
                  {busyMs > 0
                    ? isZh
                      ? `总耗时 ${formatStatDuration(busyMs, true)}`
                      : `Total ${formatStatDuration(busyMs, false)}`
                    : isZh
                      ? `${stats.runCount} 次运行`
                      : `${stats.runCount} runs`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    {isZh ? "轮次与步骤" : "Rounds & steps"}
                  </div>
                  <div className="mt-0.5 text-base font-bold text-foreground tabular-nums">
                    {stats.turns}{" "}
                    <small className="text-[11px] font-medium text-muted-foreground">
                      {isZh ? `轮 · ${stats.steps} 步` : `rounds · ${stats.steps} steps`}
                    </small>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    {isZh ? "平均输出速率" : "Avg speed"}
                  </div>
                  <div className="mt-0.5 text-base font-bold text-foreground tabular-nums">
                    {rateNumber === null ? (
                      <small className="text-xs font-medium text-muted-foreground">
                        {notRecorded}
                      </small>
                    ) : (
                      <>
                        {rateNumber}{" "}
                        <small className="text-[11px] font-medium text-muted-foreground">
                          {isZh ? "令牌/秒" : "tok/s"}
                        </small>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {modelPct !== null && toolPct !== null ? (
                <div className="space-y-1">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-sky-400 transition-all duration-200"
                      style={{ width: `${modelPct}%` }}
                    />
                    <div
                      className="bg-emerald-400 transition-all duration-200"
                      style={{ width: `${toolPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
                    <span>
                      {isZh
                        ? `模型思考 ${modelPct}% (${formatStatDuration(stats.modelMs, true)})`
                        : `Model ${modelPct}% (${formatStatDuration(stats.modelMs, false)})`}
                    </span>
                    <span>
                      {isZh
                        ? `工具执行 ${toolPct}% (${formatStatDuration(stats.toolMs, true)})`
                        : `Tools ${toolPct}% (${formatStatDuration(stats.toolMs, false)})`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {isZh ? `累计工具调用 ${stats.steps} 次` : `${stats.steps} tool calls`}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border/60" />

            {/* Section 2: Tokens & Cache */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold text-foreground">
                  {isZh ? "令牌与缓存" : "Tokens & cache"}
                </div>
                {cacheHitPercent !== null ? (
                  <span className="inline-flex h-5 items-center rounded-full bg-sky-500/15 px-2 text-[11px] font-semibold text-sky-400 tabular-nums">
                    {isZh ? `缓存命中 ${cacheHitPercent}%` : `Cache hit ${cacheHitPercent}%`}
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    {isZh ? "总计消耗" : "Total tokens"}
                  </div>
                  <div className="mt-0.5 text-base font-bold text-foreground tabular-nums">
                    {totalText}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    {isZh ? "缓存读取" : "Cache read"}
                  </div>
                  <div className="mt-0.5 text-base font-bold text-foreground tabular-nums">
                    {cachedReadText}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground tabular-nums">
                <span>
                  {isZh ? "总输入：" : "Input: "}
                  <strong className="font-semibold text-foreground">
                    {stats.inputTokens === null ? notReported : formatTokenCount(stats.inputTokens)}
                  </strong>
                </span>
                <span>
                  {isZh ? "总输出：" : "Output: "}
                  <strong className="font-semibold text-foreground">
                    {stats.outputTokens === null
                      ? notReported
                      : formatTokenCount(stats.outputTokens)}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </PopoverPopup>
      </Popover>
    </div>
  );
});
