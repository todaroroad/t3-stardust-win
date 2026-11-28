import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  effectiveSnoozed,
  hasUnseenCompletion,
  hasUnseenRunFailure,
} from "@t3tools/client-runtime/state/thread-settled";
import type { ContextMenuSource, EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  LayersIcon,
  LocateFixedIcon,
  LocateOffIcon,
  PinIcon,
  SparklesIcon,
  SquarePenIcon,
  WorkflowIcon,
} from "lucide-react";
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";

import { composerDraftHasUserContent, useComposerDraftStore } from "~/composerDraftStore";
import { cn } from "~/lib/utils";
import {
  resolveSemanticCategoryIcon,
  StardustSemanticIcon,
} from "~/lib/stardustSemanticIcons";
import { serverEnvironment } from "~/state/server";
import { useUiStateStore } from "~/uiStateStore";
import {
  resolveSidebarRowStatus,
  resolveThreadLastVisitedAt,
} from "../Sidebar.logic";
import { SharedTooltipTrigger } from "../ui/shared-tooltip";
import {
  getVisibleCategories,
  resolveStardustThreadCategory,
  setCategorySettingsDialogOpen,
  setCollapsedCategories,
  setPinnedSectionCollapsed,
  toggleCategoryCollapsed,
  togglePinnedSectionCollapsed,
  toggleSidebarNoAutoLocate,
  uncollapseCategory,
  UNSORTED_CATEGORY_ID,
  useCollapsedCategories,
  usePinnedSectionCollapsed,
  useSidebarNoAutoLocate,
  useStardustCategorySettings,
  useThreadCategoryOverrides,
} from "./stardustCategories";
import { useStarredSuggestionModels } from "./StardustSidebarCategoryModals";

export function isThreadActivelyRunning(t: EnvironmentThreadShell): boolean {
  const status = resolveSidebarRowStatus(t);
  return status === "working" || status === "preparing";
}

function isThreadUnreadCompleted(
  t: EnvironmentThreadShell,
  localLastVisitedAtById: Readonly<Record<string, string>>,
): boolean {
  const key = scopedThreadKey(scopeThreadRef(t.environmentId, t.id));
  const lastVisitedAt = resolveThreadLastVisitedAt(t.lastVisitedAt, localLastVisitedAtById[key]);
  const enriched = { ...t, lastVisitedAt };
  return resolveSidebarRowStatus(enriched) === "ready" && hasUnseenCompletion(enriched);
}

/**
 * Toggle button allowing the user to switch right-hand chat content without
 * auto-expanding or scrolling the sidebar to that conversation's category/row.
 */
export const StardustSidebarLocateLockButton = memo(function StardustSidebarLocateLockButton(props: {
  readonly compact?: boolean | undefined;
}) {
  const noAutoLocate = useSidebarNoAutoLocate();
  const label = noAutoLocate
    ? "已开启「不跳转侧栏」：点击会话仅切换右侧内容，不自动展开或滚动定位侧栏（点击恢复自动定位）"
    : "点击开启「不跳转侧栏」：切换会话时保持侧栏当前位置与折叠状态";
  return (
    <SharedTooltipTrigger
      render={
        <button
          type="button"
          aria-pressed={noAutoLocate}
          aria-label={label}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebarNoAutoLocate();
          }}
          className={cn(
            "inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors duration-150 select-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
            noAutoLocate
              ? "bg-sky-500/16 text-sky-400 hover:bg-sky-500/24"
              : "text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground",
          )}
        />
      }
      label={label}
    >
      {noAutoLocate ? (
        <LocateOffIcon className="size-3.5 shrink-0" />
      ) : (
        <LocateFixedIcon className="size-3.5 shrink-0" />
      )}
      {!props.compact ? <span>{noAutoLocate ? "不跳转" : "定位"}</span> : null}
    </SharedTooltipTrigger>
  );
});

type AttentionKind = "approval" | "question" | "failed" | "unread";

const ACK_ATTENTION_STORAGE_KEY = "t3m:ack-attention:v1";

function readAckAttentionMap(): Readonly<Record<string, string>> {
  try {
    const raw = window.localStorage.getItem(ACK_ATTENTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.length > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeAckAttentionMap(next: Readonly<Record<string, string>>) {
  try {
    const entries = Object.entries(next).slice(-200);
    window.localStorage.setItem(ACK_ATTENTION_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignore
  }
}

function attentionFailureToken(t: EnvironmentThreadShell): string {
  return t.latestRun?.id ?? t.latestRun?.completedAt ?? "failed";
}

function getThreadAttentionKind(
  t: EnvironmentThreadShell,
  acknowledgedMap: Readonly<Record<string, string>>,
  routeRowThreadKey: string | null,
  localLastVisitedAtById: Readonly<Record<string, string>>,
): AttentionKind | null {
  const key = scopedThreadKey(scopeThreadRef(t.environmentId, t.id));
  if (t.hasPendingApprovals || t.pendingSubagentRequest === "approval") return "approval";
  if (
    t.hasPendingUserInput ||
    t.pendingSubagentRequest === "user_input" ||
    t.hasActionableProposedPlan
  ) {
    return "question";
  }
  if (routeRowThreadKey === key) return null;
  if (acknowledgedMap[key] === attentionFailureToken(t)) return null;
  const lastVisitedAt = resolveThreadLastVisitedAt(t.lastVisitedAt, localLastVisitedAtById[key]);
  if (hasUnseenRunFailure({ ...t, lastVisitedAt })) {
    return "failed";
  }
  return null;
}

function eventContextMenuSource(event: ReactMouseEvent): ContextMenuSource {
  return event.nativeEvent instanceof PointerEvent && event.nativeEvent.button === -1
    ? "keyboard"
    : "mouse";
}

const DISMISSED_SUGGEST_KEY = "t3m:dismissed-suggest-count:v1";

/**
 * Top Alerts Tier in `所有项目`: `待处理` + `工作流`
 * (Official native `运行中` and `待编辑` render directly as native sidebar sections at the top!)
 */
export const StardustAllProjectsTopWorkbench = memo(function StardustAllProjectsTopWorkbench({
  allThreads,
  connectedEnvironmentIds,
  routeRowThreadKey,
  onNavigateToThread,
  onOpenWorkflows,
  onSettleThread,
  onThreadContextMenu,
}: {
  readonly allThreads: readonly EnvironmentThreadShell[];
  readonly connectedEnvironmentIds: readonly EnvironmentId[];
  readonly routeRowThreadKey: string | null;
  readonly projectDisplayNameByKey?: ReadonlyMap<string, string> | undefined;
  readonly onNavigateToThread: (ref: ScopedThreadRef) => void;
  readonly onOpenWorkflows: (target?: {
    readonly env: EnvironmentId;
    readonly run: string;
  }) => void;
  readonly onSettleThread: (ref: ScopedThreadRef) => void;
  readonly onThreadContextMenu?:
    | ((
        ref: ScopedThreadRef,
        position: { x: number; y: number },
        source: ContextMenuSource,
      ) => void)
    | undefined;
}) {
  const localLastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);

  const [attentionExpanded, setAttentionExpanded] = useState(true);
  const [workflowsExpanded, setWorkflowsExpanded] = useState(true);
  const [acknowledgedMap, setAcknowledgedMap] = useState<Readonly<Record<string, string>>>(() =>
    readAckAttentionMap(),
  );

  const envKey = useMemo(() => JSON.stringify(connectedEnvironmentIds), [connectedEnvironmentIds]);
  const workflowsAcross = useAtomValue(serverEnvironment.workflowsLiveAcross(envKey));

  const attentionRows = useMemo(() => {
    const nowIso = new Date().toISOString();
    const out: Array<{
      readonly key: string;
      readonly thread: EnvironmentThreadShell;
      readonly kind: AttentionKind;
    }> = [];
    for (const t of allThreads) {
      if (
        t.archivedAt ||
        t.settledOverride === "settled" ||
        t.settledAt ||
        t.lineage?.parentThreadId ||
        effectiveSnoozed(t, { now: nowIso })
      ) {
        continue;
      }
      const kind = getThreadAttentionKind(
        t,
        acknowledgedMap,
        routeRowThreadKey,
        localLastVisitedAtById,
      );
      if (kind) {
        out.push({
          key: scopedThreadKey(scopeThreadRef(t.environmentId, t.id)),
          thread: t,
          kind,
        });
      }
    }
    return out;
  }, [allThreads, acknowledgedMap, routeRowThreadKey, localLastVisitedAtById]);

  const liveWorkflowItems = useMemo(() => {
    const items: Array<{
      readonly key: string;
      readonly environmentId: EnvironmentId;
      readonly runId: string;
      readonly title: string;
      readonly subtitle: string;
      readonly needsYou: boolean;
      readonly stepThreadRef?: ScopedThreadRef | undefined;
    }> = [];
    const seenRuns = new Set<string>();

    for (const { environmentId, result } of workflowsAcross) {
      if (!AsyncResult.isSuccess(result) || !result.value) continue;
      const openQuestionRunIds = new Set((result.value.questions ?? []).map((q) => q.runId));
      for (const run of result.value.runs ?? []) {
        if (run.parentRunId !== null) continue;
        const hasQuestion = openQuestionRunIds.has(run.runId);
        const isActive =
          run.status === "running" ||
          run.status === "waiting" ||
          run.status === "paused" ||
          hasQuestion;
        if (!isActive) continue;
        const rKey = `${environmentId}:${run.runId}`;
        if (seenRuns.has(rKey)) continue;
        seenRuns.add(rKey);
        const needsYou = hasQuestion || (run.status === "paused" && run.resumesAt === null);
        const subtitle = hasQuestion
          ? "等待你的输入"
          : run.status === "paused"
            ? run.detail
              ? `已暂停 · ${run.detail}`
              : "已暂停 · 待处理"
            : run.status === "waiting"
              ? run.detail
                ? `等待中 · ${run.detail}`
                : "等待中"
              : run.detail
                ? `${run.workflow} · ${run.detail}`
                : "运行中";
        items.push({
          key: rKey,
          environmentId,
          runId: run.runId,
          title: run.title || run.workflow || "工作流",
          subtitle,
          needsYou,
        });
      }
    }

    for (const t of allThreads) {
      if (!t.workflowRun || t.archivedAt) continue;
      const rKey = `${t.workflowRun.environmentId}:${t.workflowRun.runId}`;
      if (seenRuns.has(rKey)) continue;
      const active =
        isThreadActivelyRunning(t) || t.hasPendingApprovals || t.hasPendingUserInput;
      if (!active) continue;
      seenRuns.add(rKey);
      items.push({
        key: rKey,
        environmentId: t.workflowRun.environmentId,
        runId: t.workflowRun.runId,
        title: t.workflowRun.workflow,
        subtitle: `${t.workflowRun.step} · ${
          t.hasPendingApprovals || t.hasPendingUserInput ? "待确认" : "执行中"
        }`,
        needsYou: t.hasPendingApprovals || t.hasPendingUserInput,
        stepThreadRef: scopeThreadRef(t.environmentId, t.id),
      });
    }

    return items;
  }, [workflowsAcross, allThreads]);

  if (attentionRows.length === 0 && liveWorkflowItems.length === 0) {
    return null;
  }

  return (
    <li className="list-none px-1 pt-0.5 pb-1 select-none">
      <div className="space-y-1.5 border-b border-sidebar-border/45 pb-1.5">
        {/* 1) 待处理 */}
        {attentionRows.length > 0 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 py-1">
            <button
              type="button"
              aria-expanded={attentionExpanded}
              onClick={() => setAttentionExpanded((v) => !v)}
              className="flex h-6 w-full cursor-pointer items-center justify-between px-2 text-xs font-medium text-sidebar-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 shrink-0 text-amber-400 transition-transform duration-150",
                    !attentionExpanded && "-rotate-90",
                  )}
                />
                <span>待处理</span>
              </span>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[11px] font-semibold text-amber-400 tabular-nums">
                {attentionRows.length}
              </span>
            </button>
            {attentionExpanded ? (
              <div className="mt-1 space-y-0.5 px-1">
                {attentionRows.map(({ key, thread, kind }) => {
                  const ref = scopeThreadRef(thread.environmentId, thread.id);
                  const badgeLabel =
                    kind === "approval"
                      ? "待授权"
                      : kind === "question"
                        ? "待回答"
                        : kind === "failed"
                          ? "运行异常"
                          : "待查看";
                  return (
                    <div
                      key={key}
                      onContextMenu={(e) => {
                        if (!onThreadContextMenu) return;
                        e.preventDefault();
                        onThreadContextMenu(
                          ref,
                          { x: e.clientX, y: e.clientY },
                          eventContextMenuSource(e),
                        );
                      }}
                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-sidebar-row-hover"
                    >
                      <AlertCircleIcon
                        className={cn(
                          "size-3.5 shrink-0",
                          kind === "failed" ? "text-destructive" : "text-amber-400",
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => onNavigateToThread(ref)}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                      >
                        <div className="truncate font-medium text-sidebar-foreground">
                          {thread.title || "未命名会话"}
                        </div>
                        <div className="text-[10.5px] text-amber-400/90">{badgeLabel}</div>
                      </button>
                      <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
                        {kind === "failed" || kind === "unread" ? (
                          <button
                            type="button"
                            title="标为已阅"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAcknowledgedMap((prev) => {
                                const next = {
                                  ...prev,
                                  [key]: attentionFailureToken(thread),
                                };
                                writeAckAttentionMap(next);
                                return next;
                              });
                            }}
                            className="inline-flex h-5 cursor-pointer items-center rounded border border-sidebar-border bg-sidebar px-1.5 text-[10.5px] text-sidebar-muted-foreground hover:text-sidebar-foreground"
                          >
                            已阅
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="收尾归档"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSettleThread(ref);
                          }}
                          className="inline-flex h-5 cursor-pointer items-center rounded border border-sidebar-border bg-sidebar px-1.5 text-[10.5px] text-sidebar-muted-foreground hover:text-sidebar-foreground"
                        >
                          <CheckIcon className="mr-0.5 size-2.5" />
                          收尾
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 2) 工作流 */}
        {liveWorkflowItems.length > 0 ? (
          <div className="rounded-lg border border-sidebar-border/60 bg-sidebar/40 py-1">
            <button
              type="button"
              aria-expanded={workflowsExpanded}
              onClick={() => setWorkflowsExpanded((v) => !v)}
              className="flex h-6 w-full cursor-pointer items-center justify-between px-2 text-xs font-medium text-sidebar-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 shrink-0 text-sidebar-muted-foreground transition-transform duration-150",
                    !workflowsExpanded && "-rotate-90",
                  )}
                />
                <WorkflowIcon className="size-3.5 text-violet-400" />
                <span>工作流</span>
              </span>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500/20 px-1.5 text-[11px] font-semibold text-violet-400 tabular-nums">
                {liveWorkflowItems.length}
              </span>
            </button>
            {workflowsExpanded ? (
              <div className="mt-1 space-y-0.5 px-1">
                {liveWorkflowItems.map((wf) => (
                  <button
                    key={wf.key}
                    type="button"
                    onClick={() => {
                      if (wf.stepThreadRef) onNavigateToThread(wf.stepThreadRef);
                      else onOpenWorkflows({ env: wf.environmentId, run: wf.runId });
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-sidebar-row-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-sidebar-foreground">
                        {wf.title}
                      </div>
                      <div
                        className={cn(
                          "truncate text-[10.5px]",
                          wf.needsYou ? "text-amber-400" : "text-sidebar-muted-foreground",
                        )}
                      >
                        {wf.subtitle}
                      </div>
                    </div>
                    <ChevronRightIcon className="size-3.5 shrink-0 text-sidebar-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
});

/**
 * Unified Category / Section Status Indicators:
 * - Blue dot (`bg-sky-400`): actively running (`运行中`)
 * - Green dot (`bg-emerald-400`): completed & unread (`已完成未查看`)
 * - Amber pen (`SquarePenIcon` `text-amber-400`): has unsent draft (`有未发送草稿`)
 */
function SectionStatusBadges(props: {
  readonly hasRunning: boolean;
  readonly hasUnreadCompleted: boolean;
  readonly hasDraft: boolean;
}) {
  if (!props.hasRunning && !props.hasUnreadCompleted && !props.hasDraft) {
    return null;
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {props.hasDraft ? (
        <span title="含未发送草稿" className="inline-flex items-center text-amber-400">
          <SquarePenIcon aria-hidden className="size-3 shrink-0" />
        </span>
      ) : null}
      {props.hasUnreadCompleted ? (
        <span
          title="含已完成但未查看的会话"
          className="size-2 shrink-0 rounded-full bg-emerald-400"
        />
      ) : null}
      {props.hasRunning ? (
        <span
          title="含正在运行的会话"
          className="size-2 shrink-0 rounded-full bg-sky-400"
        />
      ) : null}
    </span>
  );
}

function useUnsentDraftThreadKeySet(): ReadonlySet<string> {
  const keys = useComposerDraftStore(
    useShallow((store) => {
      const matched: string[] = [];
      for (const [key, draft] of Object.entries(store.draftsByThreadKey)) {
        if (store.draftThreadsByThreadKey[key] !== undefined) continue;
        if (composerDraftHasUserContent(draft)) {
          matched.push(key);
        }
      }
      return matched;
    }),
  );
  return useMemo(() => new Set(keys), [keys]);
}

/**
 * Collapsible `置顶` Section Header in `所有项目`
 */
export const StardustAllProjectsPinnedHeader = memo(function StardustAllProjectsPinnedHeader({
  pinnedThreads,
  routeRowThreadKey,
}: {
  readonly pinnedThreads: readonly EnvironmentThreadShell[];
  readonly routeRowThreadKey: string | null;
}) {
  const isCollapsed = usePinnedSectionCollapsed();
  const noAutoLocate = useSidebarNoAutoLocate();
  const localLastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);
  const draftThreadKeys = useUnsentDraftThreadKeySet();

  const containsActiveRoute = useMemo(
    () =>
      routeRowThreadKey !== null &&
      pinnedThreads.some(
        (t) => scopedThreadKey(scopeThreadRef(t.environmentId, t.id)) === routeRowThreadKey,
      ),
    [pinnedThreads, routeRowThreadKey],
  );

  const { hasRunning, hasUnreadCompleted, hasDraft } = useMemo(() => {
    let running = false;
    let unread = false;
    let draft = false;
    for (const t of pinnedThreads) {
      const key = scopedThreadKey(scopeThreadRef(t.environmentId, t.id));
      if (!running && isThreadActivelyRunning(t)) running = true;
      if (!unread && key !== routeRowThreadKey && isThreadUnreadCompleted(t, localLastVisitedAtById)) {
        unread = true;
      }
      if (!draft && draftThreadKeys.has(key)) draft = true;
    }
    return { hasRunning: running, hasUnreadCompleted: unread, hasDraft: draft };
  }, [pinnedThreads, routeRowThreadKey, localLastVisitedAtById, draftThreadKeys]);

  // Auto-expand only when the user navigates to a *different* thread inside `置顶`
  // AND "Don't Auto-Locate" is OFF.
  const prevRouteKeyRef = useRef<string | null>(routeRowThreadKey);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reveals newly navigated pinned thread unless sidebar auto-locate is locked
  useEffect(() => {
    if (prevRouteKeyRef.current === routeRowThreadKey) return;
    prevRouteKeyRef.current = routeRowThreadKey;
    if (noAutoLocate) return;
    if (containsActiveRoute && isCollapsed) {
      setPinnedSectionCollapsed(false);
    }
  }, [routeRowThreadKey, containsActiveRoute, isCollapsed, noAutoLocate]);

  if (pinnedThreads.length === 0) return null;

  return (
    <li className="list-none pt-1 select-none">
      <button
        type="button"
        data-sidebar-row="sec:pinned"
        aria-expanded={!isCollapsed}
        onClick={() => togglePinnedSectionCollapsed()}
        className={cn(
          "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-row-hover",
          isCollapsed && containsActiveRoute && "bg-sidebar-row-active/45",
        )}
      >
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-sidebar-muted-foreground transition-transform duration-150",
            isCollapsed && "-rotate-90",
          )}
        />
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/14 text-primary">
          <PinIcon className="size-3" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">置顶</span>
        {isCollapsed ? (
          <SectionStatusBadges
            hasRunning={hasRunning}
            hasUnreadCompleted={hasUnreadCompleted}
            hasDraft={hasDraft}
          />
        ) : null}
        <span className="shrink-0 text-xs text-sidebar-muted-foreground tabular-nums">
          {pinnedThreads.length}
        </span>
      </button>
    </li>
  );
});

/**
 * Middle Tier in `所有项目`: `分类` Auto-Grouping Section
 */
export const StardustAllProjectsCategories = memo(function StardustAllProjectsCategories({
  activeThreads,
  workingThreads = [],
  routeRowThreadKey,
  projectDisplayNameByKey,
  showLocateLockInToolbar = false,
  renderThreadRow,
}: {
  readonly activeThreads: readonly EnvironmentThreadShell[];
  readonly workingThreads?: readonly EnvironmentThreadShell[] | undefined;
  readonly routeRowThreadKey: string | null;
  readonly projectDisplayNameByKey: ReadonlyMap<string, string>;
  readonly showLocateLockInToolbar?: boolean | undefined;
  readonly renderThreadRow: (thread: EnvironmentThreadShell) => ReactNode;
}) {
  const settings = useStardustCategorySettings();
  const overrides = useThreadCategoryOverrides();
  const collapsedSet = useCollapsedCategories();
  const noAutoLocate = useSidebarNoAutoLocate();
  const starredModels = useStarredSuggestionModels();
  const localLastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);
  const draftThreadKeys = useUnsentDraftThreadKeySet();

  const [dismissedSuggestAtCount, setDismissedSuggestAtCount] = useState<number>(() => {
    try {
      return Number(window.localStorage.getItem(DISMISSED_SUGGEST_KEY) || "0") || 0;
    } catch {
      return 0;
    }
  });

  const visibleCategories = useMemo(
    () => getVisibleCategories(settings, overrides),
    [settings, overrides],
  );

  const { occupiedSections, emptyCategories, unsortedCount } = useMemo(() => {
    const buckets = new Map<string, EnvironmentThreadShell[]>();
    const runningCatIds = new Set<string>();
    for (const cat of visibleCategories) buckets.set(cat.id, []);

    for (const wt of workingThreads) {
      const wtKey = scopedThreadKey(scopeThreadRef(wt.environmentId, wt.id));
      const wtProj = projectDisplayNameByKey.get(`${wt.environmentId}:${wt.projectId}`) ?? null;
      const wtCat = resolveStardustThreadCategory(
        overrides,
        wtKey,
        { title: wt.title, projectName: wtProj },
        settings,
        visibleCategories,
      );
      runningCatIds.add(buckets.has(wtCat) ? wtCat : UNSORTED_CATEGORY_ID);
    }

    for (const t of activeThreads) {
      const threadKey = scopedThreadKey(scopeThreadRef(t.environmentId, t.id));
      const projName = projectDisplayNameByKey.get(`${t.environmentId}:${t.projectId}`) ?? null;
      const catId = resolveStardustThreadCategory(
        overrides,
        threadKey,
        { title: t.title, projectName: projName },
        settings,
        visibleCategories,
      );
      const bucket = buckets.get(catId) ?? buckets.get(UNSORTED_CATEGORY_ID);
      bucket?.push(t);
    }

    const occupied: Array<{
      readonly id: string;
      readonly label: string;
      readonly threads: readonly EnvironmentThreadShell[];
      readonly hasRunning: boolean;
      readonly hasUnreadCompleted: boolean;
      readonly hasDraft: boolean;
    }> = [];
    const empty: Array<(typeof visibleCategories)[number]> = [];

    const orderedCats = [
      ...visibleCategories.filter((c) => c.id === UNSORTED_CATEGORY_ID),
      ...visibleCategories.filter((c) => c.id !== UNSORTED_CATEGORY_ID),
    ];

    for (const cat of orderedCats) {
      const list = buckets.get(cat.id) ?? [];
      if (list.length > 0) {
        let hasRunning = runningCatIds.has(cat.id);
        let hasUnreadCompleted = false;
        let hasDraft = false;
        for (const t of list) {
          const key = scopedThreadKey(scopeThreadRef(t.environmentId, t.id));
          if (!hasRunning && isThreadActivelyRunning(t)) hasRunning = true;
          if (
            !hasUnreadCompleted &&
            key !== routeRowThreadKey &&
            isThreadUnreadCompleted(t, localLastVisitedAtById)
          ) {
            hasUnreadCompleted = true;
          }
          if (!hasDraft && draftThreadKeys.has(key)) hasDraft = true;
        }
        occupied.push({
          id: cat.id,
          label: cat.label,
          threads: list,
          hasRunning,
          hasUnreadCompleted,
          hasDraft,
        });
      } else if (cat.id !== UNSORTED_CATEGORY_ID && !settings.hideEmptyCategories) {
        empty.push(cat);
      }
    }

    return {
      occupiedSections: occupied,
      emptyCategories: empty,
      unsortedCount: (buckets.get(UNSORTED_CATEGORY_ID) ?? []).length,
    };
  }, [
    activeThreads,
    workingThreads,
    overrides,
    projectDisplayNameByKey,
    settings,
    visibleCategories,
    routeRowThreadKey,
    localLastVisitedAtById,
    draftThreadKeys,
  ]);

  // Auto-uncollapse only when navigating to a *different* conversation inside a collapsed category
  // AND "Don't Auto-Locate" is OFF.
  const prevRouteKeyRef = useRef<string | null>(routeRowThreadKey);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reveals newly navigated thread unless sidebar auto-locate is locked
  useEffect(() => {
    if (prevRouteKeyRef.current === routeRowThreadKey) return;
    prevRouteKeyRef.current = routeRowThreadKey;
    if (!routeRowThreadKey || noAutoLocate) return;
    const hit = occupiedSections.find((sec) =>
      sec.threads.some(
        (t) => scopedThreadKey(scopeThreadRef(t.environmentId, t.id)) === routeRowThreadKey,
      ),
    );
    if (hit) {
      uncollapseCategory(hit.id);
    }
  }, [routeRowThreadKey, occupiedSections, noAutoLocate]);

  if (!settings.enabled || settings.preset === "project") return null;

  const allOccupiedCollapsed =
    occupiedSections.length > 0 && occupiedSections.every((sec) => collapsedSet.has(sec.id));

  const showSuggestionBanner =
    settings.suggestEnabled &&
    starredModels.length > 0 &&
    unsortedCount >= 5 &&
    dismissedSuggestAtCount < unsortedCount;

  return (
    <>
      <li className="list-none px-2.5 pt-2 pb-1 select-none">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium tracking-wide text-sidebar-muted-foreground">
            分类
          </span>
          <div className="flex items-center gap-1">
            {showLocateLockInToolbar ? <StardustSidebarLocateLockButton /> : null}
            {occupiedSections.length > 0 ? (
              <button
                type="button"
                title={allOccupiedCollapsed ? "展开全部分类" : "折叠全部分类"}
                onClick={() => {
                  if (allOccupiedCollapsed) {
                    setCollapsedCategories([]);
                  } else {
                    setCollapsedCategories(occupiedSections.map((sec) => sec.id));
                  }
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
              >
                {allOccupiedCollapsed ? (
                  <ChevronsUpDownIcon className="size-3" />
                ) : (
                  <ChevronsDownUpIcon className="size-3" />
                )}
                <span>{allOccupiedCollapsed ? "展开" : "折叠"}</span>
              </button>
            ) : null}
            <button
              type="button"
              title="编辑侧边栏分类与关键词"
              onClick={() => setCategorySettingsDialogOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-sidebar-muted-foreground transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
            >
              <LayersIcon className="size-3" />
              <span>自定义</span>
            </button>
          </div>
        </div>
      </li>

      {showSuggestionBanner ? (
        <li className="list-none px-2 pb-1.5">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/8 px-2.5 py-1.5 text-[11.5px]">
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-sidebar-foreground">
              <SparklesIcon className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">有 {unsortedCount} 个待归类会话可建议分类</span>
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setCategorySettingsDialogOpen(true)}
                className="cursor-pointer rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground"
              >
                查看
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissedSuggestAtCount(unsortedCount);
                  try {
                    window.localStorage.setItem(DISMISSED_SUGGEST_KEY, String(unsortedCount));
                  } catch {
                    // ignore
                  }
                }}
                className="cursor-pointer px-1 text-[11px] text-sidebar-muted-foreground hover:text-sidebar-foreground"
              >
                忽略
              </button>
            </div>
          </div>
        </li>
      ) : null}

      {occupiedSections.map((sec) => {
        const containsActiveRoute =
          routeRowThreadKey !== null &&
          sec.threads.some(
            (t) => scopedThreadKey(scopeThreadRef(t.environmentId, t.id)) === routeRowThreadKey,
          );
        const isCollapsed = collapsedSet.has(sec.id);
        const catIcon = resolveSemanticCategoryIcon(sec.label, sec.id);
        return (
          <li key={`cat-sec:${sec.id}`} className="list-none">
            <button
              type="button"
              data-sidebar-row={`cat:${sec.id}`}
              aria-expanded={!isCollapsed}
              onClick={() => toggleCategoryCollapsed(sec.id)}
              className={cn(
                "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-row-hover select-none",
                isCollapsed && containsActiveRoute && "bg-sidebar-row-active/45",
              )}
            >
              <ChevronDownIcon
                className={cn(
                  "size-3.5 shrink-0 text-sidebar-muted-foreground transition-transform duration-150",
                  isCollapsed && "-rotate-90",
                )}
              />
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-sidebar-foreground/[0.08]">
                <StardustSemanticIcon
                  name={catIcon.name}
                  color={catIcon.color}
                  className="size-3.5"
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{sec.label}</span>
              {isCollapsed ? (
                <SectionStatusBadges
                  hasRunning={sec.hasRunning}
                  hasUnreadCompleted={sec.hasUnreadCompleted}
                  hasDraft={sec.hasDraft}
                />
              ) : null}
              <span className="shrink-0 text-xs text-sidebar-muted-foreground tabular-nums">
                {sec.threads.length}
              </span>
            </button>
            {!isCollapsed ? (
              <ul role="presentation" className="mt-0.5 flex flex-col gap-px pl-1">
                {sec.threads.map((thread) => renderThreadRow(thread))}
              </ul>
            ) : null}
          </li>
        );
      })}

      {emptyCategories.length > 0 ? (
        <li className="list-none pt-1 pb-2 select-none">
          <div className="flex flex-col gap-0.5">
            {emptyCategories.map((cat) => {
              const catIcon = resolveSemanticCategoryIcon(cat.label, cat.id);
              return (
                <button
                  key={`cat-empty:${cat.id}`}
                  type="button"
                  onClick={() => setCategorySettingsDialogOpen(true)}
                  title="暂无匹配会话 · 点击管理分类关键词"
                  className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[12.5px] text-sidebar-muted-foreground/80 transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
                >
                  <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded bg-sidebar-foreground/[0.06] opacity-75">
                    <StardustSemanticIcon
                      name={catIcon.name}
                      color={catIcon.color}
                      className="size-3"
                    />
                  </span>
                  <span className="min-w-0 truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </li>
      ) : null}
    </>
  );
});
