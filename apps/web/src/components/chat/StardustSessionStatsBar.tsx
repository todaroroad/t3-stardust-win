import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import { orchestrationV2RunWorkStartedAt, type OrchestrationV2RunStatus } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { useLocale } from "gt-react";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";

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

function positionStatsDockPill(pill: HTMLElement | null, btn: HTMLElement | null) {
  if (!pill) return;
  if (!btn) {
    pill.style.opacity = "0";
    return;
  }
  pill.style.opacity = "1";
  pill.style.width = `${btn.offsetWidth}px`;
  pill.style.transform = `translateX(${btn.offsetLeft}px)`;
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
  const [open, setOpen] = useState<"session" | "tokens" | null>(null);
  const clusterRef = useRef<HTMLDivElement>(null);
  const dockPillRef = useRef<HTMLDivElement>(null);

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

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- syncs hover/open pill geometry
  useLayoutEffect(() => {
    if (!open) {
      positionStatsDockPill(dockPillRef.current, null);
      return;
    }
    const target = clusterRef.current?.querySelector<HTMLElement>(
      `[data-t3m-stats-trig="${open}"]`,
    );
    positionStatsDockPill(dockPillRef.current, target ?? null);
  }, [open]);

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

  const leftSummary =
    current === null
      ? [`${roundsText} ${stepsText(stats.steps)}`, rateText].filter(Boolean).join(" · ")
      : [
          isZh ? `第 ${stats.turns + 1} 轮` : `Round ${stats.turns + 1}`,
          runStatusLabel(current.status),
          stepsText(current.steps),
          formatStatDuration(now - current.startMs, isZh, true),
        ].join(" · ");

  const rightSummary = [
    stats.inputTokens === null && stats.outputTokens === null
      ? notReported
      : isZh
        ? `${formatTokenCount(total)} 令牌`
        : `${formatTokenCount(total)} tok`,
    cacheCompact,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      data-t3m-stats-bar
      className="pointer-events-auto flex items-center justify-center pt-1.5 select-none"
    >
      <div
        ref={clusterRef}
        onMouseLeave={() => {
          if (!open) positionStatsDockPill(dockPillRef.current, null);
        }}
        className="relative inline-flex max-w-full items-center gap-0.5 rounded-full border border-border/55 bg-background/75 p-0.5 text-[11.5px] leading-none text-muted-foreground shadow-xs backdrop-blur-md"
      >
        <div
          ref={dockPillRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0.5 left-0 rounded-full bg-muted/85 opacity-0 transition-[transform,width,opacity] duration-180 ease-out"
        />

        <Popover
          open={open === "session"}
          onOpenChange={(next) => setOpen(next ? "session" : null)}
        >
          <PopoverTrigger
            openOnHover
            delay={120}
            render={
              <button
                type="button"
                data-t3m-stats-trig="session"
                onMouseEnter={(e) => positionStatsDockPill(dockPillRef.current, e.currentTarget)}
                className="relative z-10 inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full px-2.5 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground data-[popup-open]:text-foreground"
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
            <span className="truncate tabular-nums">{leftSummary}</span>
          </PopoverTrigger>
          <PopoverPopup side="top" align="center" sideOffset={10} className="w-76 rounded-2xl p-3.5">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <PopoverTitle className="text-[13px] font-semibold text-foreground">
                  {isZh ? "会话概览" : "Session overview"}
                </PopoverTitle>
                <span className="inline-flex h-5 items-center rounded-full bg-emerald-500/15 px-2 text-[11px] font-semibold text-emerald-400">
                  {isZh ? "精简 3 层" : "3-layer summary"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 border-b border-border/60 pb-2.5">
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    {isZh ? "轮次与步骤" : "Rounds & steps"}
                  </div>
                  <div className="mt-0.5 text-lg font-bold text-foreground tabular-nums">
                    {stats.turns}{" "}
                    <small className="text-[11px] font-medium text-muted-foreground">
                      {isZh ? `轮 · ${stats.steps} 步` : `rounds · ${stats.steps} steps`}
                    </small>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    {isZh ? "平均速率" : "Avg speed"}
                  </div>
                  <div className="mt-0.5 text-lg font-bold text-foreground tabular-nums">
                    {rateNumber === null ? (
                      <small className="text-xs font-medium text-muted-foreground">
                        {notRecorded}
                      </small>
                    ) : (
                      <>
                        {rateNumber}{" "}
                        <small className="text-[11px] font-medium text-muted-foreground">
                          {isZh ? "/秒" : "tok/s"}
                        </small>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground tabular-nums">
                {modelPct !== null && toolPct !== null ? (
                  <>
                    <span>{isZh ? `模型思考 ${modelPct}%` : `Model ${modelPct}%`}</span>
                    <span>{isZh ? `工具执行 ${toolPct}%` : `Tools ${toolPct}%`}</span>
                  </>
                ) : (
                  <span>
                    {isZh ? `累计工具调用 ${stats.steps} 次` : `${stats.steps} tool calls`}
                  </span>
                )}
              </div>
            </div>
          </PopoverPopup>
        </Popover>

        {stats.usageReported ? (
          <>
            <span aria-hidden="true" className="mx-0.5 h-3 w-px shrink-0 bg-border/70" />
            <Popover
              open={open === "tokens"}
              onOpenChange={(next) => setOpen(next ? "tokens" : null)}
            >
              <PopoverTrigger
                openOnHover
                delay={120}
                render={
                  <button
                    type="button"
                    data-t3m-stats-trig="tokens"
                    onMouseEnter={(e) =>
                      positionStatsDockPill(dockPillRef.current, e.currentTarget)
                    }
                    className="relative z-10 inline-flex h-6 cursor-pointer items-center gap-1 rounded-full px-2.5 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground data-[popup-open]:text-foreground"
                  />
                }
              >
                <span className="truncate tabular-nums">{rightSummary}</span>
              </PopoverTrigger>
              <PopoverPopup
                side="top"
                align="center"
                sideOffset={10}
                className="w-76 rounded-2xl p-3.5"
              >
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <PopoverTitle className="text-[13px] font-semibold text-foreground">
                      {isZh ? "令牌与缓存" : "Tokens & cache"}
                    </PopoverTitle>
                    {cacheHitPercent !== null ? (
                      <span className="inline-flex h-5 items-center rounded-full bg-blue-500/15 px-2 text-[11px] font-semibold text-blue-400 tabular-nums">
                        {isZh ? `命中 ${cacheHitPercent}%` : `Hit ${cacheHitPercent}%`}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-b border-border/60 pb-2.5">
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        {isZh ? "总计" : "Total"}
                      </div>
                      <div className="mt-0.5 text-lg font-bold text-foreground tabular-nums">
                        {totalText}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        {isZh ? "缓存读取" : "Cache read"}
                      </div>
                      <div className="mt-0.5 text-lg font-bold text-foreground tabular-nums">
                        {cachedReadText}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground tabular-nums">
                    <span>
                      {isZh ? "输入 " : "In "}
                      {stats.inputTokens === null ? notReported : formatTokenCount(stats.inputTokens)}
                    </span>
                    <span>
                      {isZh ? "输出 " : "Out "}
                      {stats.outputTokens === null
                        ? notReported
                        : formatTokenCount(stats.outputTokens)}
                    </span>
                  </div>
                </div>
              </PopoverPopup>
            </Popover>
          </>
        ) : current !== null ? (
          <>
            <span aria-hidden="true" className="mx-0.5 h-3 w-px shrink-0 bg-border/70" />
            <span className="px-2 text-[11px] text-muted-foreground/80">
              {isZh ? "本轮结束后统计" : "Reported after turn"}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
});
