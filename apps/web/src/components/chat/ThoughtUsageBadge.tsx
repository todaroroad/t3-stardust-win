import * as DateTime from "effect/DateTime";
import { useLocale } from "gt-react";
import { use } from "react";
import { useQuietThreadProjection } from "../../state/entities";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { TimelineRowCtx, type TimelineWorkEntry } from "./timelineRowContext";

function formatTokenCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(count));
}

function estimateThoughtTokens(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  let cjkCount = 0;
  for (const ch of trimmed) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x3000 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      cjkCount += 1;
    }
  }
  const restCount = Math.max(0, trimmed.length - cjkCount);
  return Math.max(1, Math.round(cjkCount * 0.75 + restCount / 3.8));
}

function formatThoughtDuration(msValue: number, isZh: boolean): string {
  if (msValue < 10_000) {
    const tenths = (msValue / 1000).toFixed(1).replace(/\.0$/, "");
    return isZh ? `${tenths}秒` : `${tenths}s`;
  }
  const totalSeconds = Math.round(msValue / 1000);
  if (totalSeconds < 60) {
    return isZh ? `${totalSeconds}秒` : `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return isZh ? `${minutes}分${seconds}秒` : `${minutes}m ${seconds}s`;
}

export function ThoughtUsageBadge({
  workEntry,
}: {
  readonly workEntry: TimelineWorkEntry;
}) {
  const ctx = use(TimelineRowCtx);
  const locale = useLocale();
  const isZh = locale.startsWith("zh");
  const thread = useQuietThreadProjection(ctx.threadRef);
  const projection = thread?.projection ?? null;

  const item = workEntry.projectedItem?.item;
  const startMs = item?.startedAt
    ? DateTime.toEpochMillis(item.startedAt)
    : Date.parse(workEntry.createdAt);
  const endMs = item?.completedAt
    ? DateTime.toEpochMillis(item.completedAt)
    : null;
  const durationMs =
    endMs !== null && Number.isFinite(startMs) && endMs > startMs ? endMs - startMs : null;
  const durationText =
    durationMs !== null && durationMs >= 200 ? formatThoughtDuration(durationMs, isZh) : null;

  const rawText = (workEntry.detail ?? "").trim();
  const charCount = rawText.length;
  const estTokens = charCount > 0 ? estimateThoughtTokens(rawText) : null;

  const providerTurnId = item?.providerTurnId ?? null;
  const turn =
    providerTurnId !== null && projection
      ? projection.providerTurns.find(
          (candidate) => String(candidate.id) === String(providerTurnId),
        )
      : undefined;
  const rawUsage = turn?.turnTokenUsage;
  const usage =
    rawUsage && rawUsage.usageStatus !== "unavailable" && !rawUsage.localCommand
      ? rawUsage
      : undefined;

  let thoughtTokens: number | null = estTokens;
  let isExactThought = false;
  if (usage?.reasoningTokens !== undefined && usage.reasoningTokens > 0) {
    const siblings =
      providerTurnId !== null && projection
        ? projection.turnItems.filter(
            (ti) =>
              ti.type === "reasoning" && String(ti.providerTurnId) === String(providerTurnId),
          )
        : [];
    if (siblings.length <= 1) {
      thoughtTokens = usage.reasoningTokens;
      isExactThought = true;
    } else {
      thoughtTokens = Math.max(1, Math.round(usage.reasoningTokens / siblings.length));
      isExactThought = false;
    }
  }

  const inlineParts: string[] = [];
  if (durationText) inlineParts.push(durationText);
  if (thoughtTokens !== null) {
    inlineParts.push(
      isExactThought
        ? isZh
          ? `思考 ${formatTokenCount(thoughtTokens)} tok`
          : `think ${formatTokenCount(thoughtTokens)} tok`
        : `~${formatTokenCount(thoughtTokens)} tok`,
    );
  }
  if (usage?.outputTokens !== undefined) {
    inlineParts.push(
      isZh
        ? `输出 ${formatTokenCount(usage.outputTokens)}`
        : `out ${formatTokenCount(usage.outputTokens)}`,
    );
  }

  if (inlineParts.length === 0) return null;

  const cachePercent =
    usage?.inputTokens !== undefined &&
    usage.inputTokens > 0 &&
    usage.cachedInputTokens !== undefined
      ? Math.round(Math.min(1, usage.cachedInputTokens / usage.inputTokens) * 100)
      : null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            data-thought-usage-badge
            onClick={(event) => event.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted/65 px-2 py-0.5 font-mono text-[11px] leading-4 text-muted-foreground tabular-nums ring-1 ring-border/50 transition-colors hover:bg-muted hover:text-foreground"
          />
        }
      >
        {inlineParts.join(" · ")}
      </TooltipTrigger>
      <TooltipPopup>
        <div className="min-w-44 space-y-1 py-0.5 text-xs tabular-nums">
          <div className="font-medium text-foreground">
            {isZh ? "本段思考与调用用量" : "Thought & Step Usage"}
          </div>
          {durationText ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{isZh ? "思考耗时" : "Duration"}</span>
              <span>{durationText}</span>
            </div>
          ) : null}
          {thoughtTokens !== null ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{isZh ? "本段思考" : "Thought"}</span>
              <span>
                {isExactThought
                  ? `${thoughtTokens.toLocaleString()} tok`
                  : isZh
                    ? `~${thoughtTokens.toLocaleString()} tok (${charCount.toLocaleString()} 字)`
                    : `~${thoughtTokens.toLocaleString()} tok (${charCount.toLocaleString()} chars)`}
              </span>
            </div>
          ) : null}
          {usage?.outputTokens !== undefined ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{isZh ? "本步输出" : "Step output"}</span>
              <span>{usage.outputTokens.toLocaleString()} tok</span>
            </div>
          ) : null}
          {usage?.inputTokens !== undefined ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{isZh ? "本步输入" : "Step input"}</span>
              <span>{usage.inputTokens.toLocaleString()} tok</span>
            </div>
          ) : null}
          {usage?.cachedInputTokens !== undefined && cachePercent !== null ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{isZh ? "缓存命中" : "Cache hit"}</span>
              <span>
                {usage.cachedInputTokens.toLocaleString()} tok ({cachePercent}%)
              </span>
            </div>
          ) : null}
        </div>
      </TooltipPopup>
    </Tooltip>
  );
}
