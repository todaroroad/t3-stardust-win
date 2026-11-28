import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LayersIcon,
  LoaderCircleIcon,
  SparklesIcon,
  WorkflowIcon,
} from "lucide-react";
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";

import { cn } from "~/lib/utils";
import { environmentIdsKey } from "~/state/environmentAtomList";
import { serverEnvironment } from "~/state/server";
import {
  getVisibleCategories,
  resolveStardustThreadCategory,
  setCategorySettingsDialogOpen,
  toggleCategoryCollapsed,
  UNSORTED_CATEGORY_ID,
  useCollapsedCategories,
  useStardustCategorySettings,
  useThreadCategoryOverrides,
} from "./stardustCategories";
import { useStarredSuggestionModels } from "./StardustSidebarCategoryModals";

function isThreadActivelyRunning(t: EnvironmentThreadShell): boolean {
  const rs = t.latestRun?.status;
  return (
    rs === "running" ||
    rs === "starting" ||
    rs === "preparing" ||
    t.runtime?.status === "running" ||
    t.runtime?.status === "starting" ||
    t.runtime?.status === "preparing" ||
    t.runtime?.activeRunId != null
  );
}

type AttentionKind = "approval" | "question" | "failed" | "unread";

function getThreadAttentionKind(
  t: EnvironmentThreadShell,
  acknowledgedSet: ReadonlySet<string>,
  routeRowThreadKey: string | null,
): AttentionKind | null {
  const key = scopedThreadKey(scopeThreadRef(t.environmentId, t.id));
  if (t.hasPendingApprovals) return "approval";
  if (t.hasPendingUserInput || t.hasActionableProposedPlan) return "question";
  if (acknowledgedSet.has(key) || routeRowThreadKey === key) return null;
  if (t.latestRun?.status === "failed") {
    const compMs = t.latestRun.completedAt ? Date.parse(t.latestRun.completedAt) : 0;
    const visitMs =
      "visitedAt" in t && typeof t.visitedAt === "string" ? Date.parse(t.visitedAt) : 0;
    if (!visitMs || compMs > visitMs) return "failed";
  }
  return null;
}

function formatElapsedMinutes(startedAt: string | null | undefined, now: number): string {
  if (!startedAt) return "";
  const ms = now - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms <= 0) return "刚刚";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "小于 1 分";
  if (mins < 60) return `已运行 ${mins} 分`;
  const hrs = Math.floor(mins / 60);
  return `已运行 ${hrs} 时 ${mins % 60} 分`;
}

function pickCategoryGlyph(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "类";
  const ch = [...trimmed][0] ?? "类";
  return /^[a-z]$/i.test(ch) ? ch.toUpperCase() : ch;
}

const DISMISSED_SUGGEST_KEY = "t3m:dismissed-suggest-count:v1";

/**
 * Top Tier in `所有项目`: `运行中` + `待处理` + `工作流`
 */
export const StardustAllProjectsTopWorkbench = memo(function StardustAllProjectsTopWorkbench({
  allThreads,
  connectedEnvironmentIds,
  routeRowThreadKey,
  projectDisplayNameByKey,
  onNavigateToThread,
  onOpenWorkflows,
  onSettleThread,
}: {
  readonly allThreads: readonly EnvironmentThreadShell[];
  readonly connectedEnvironmentIds: readonly EnvironmentId[];
  readonly routeRowThreadKey: string | null;
  readonly projectDisplayNameByKey: ReadonlyMap<string, string>;
  readonly onNavigateToThread: (ref: ScopedThreadRef) => void;
  readonly onOpenWorkflows: (target?: {
    readonly env: EnvironmentId;
    readonly run: string;
  }) => void;
  readonly onSettleThread: (ref: ScopedThreadRef) => void;
}) {
  const [runningExpanded, setRunningExpanded] = useState(true);
  const [showAllRunning, setShowAllRunning] = useState(false);
  const [attentionExpanded, setAttentionExpanded] = useState(true);
  const [workflowsExpanded, setWorkflowsExpanded] = useState(true);
  const [expandedParentIds, setExpandedParentIds] = useState<ReadonlySet<string>>(() => new Set());
  const [acknowledgedKeys, setAcknowledgedKeys] = useState<ReadonlySet<string>>(() => new Set());

  const envKey = environmentIdsKey(connectedEnvironmentIds);
  const workflowsAcross = useAtomValue(serverEnvironment.workflowsLiveAcross(envKey));

  const { runningGroups, totalSubagentsCount } = useMemo(() => {
    const childrenByParent = new Map<string, EnvironmentThreadShell[]>();
    for (const t of allThreads) {
      if (t.archivedAt) continue;
      if (t.lineage?.parentThreadId) {
        const pKey = `${t.environmentId}:${t.lineage.parentThreadId}`;
        const arr = childrenByParent.get(pKey) ?? [];
        arr.push(t);
        childrenByParent.set(pKey, arr);
      }
    }

    const groups: Array<{
      readonly key: string;
      readonly parent: EnvironmentThreadShell;
      readonly children: readonly EnvironmentThreadShell[];
    }> = [];
    let subCount = 0;

    for (const t of allThreads) {
      if (t.archivedAt || t.lineage?.parentThreadId) continue;
      const pKey = `${t.environmentId}:${t.id}`;
      const children = (childrenByParent.get(pKey) ?? []).filter(isThreadActivelyRunning);
      if (isThreadActivelyRunning(t) || children.length > 0) {
        subCount += children.length;
        groups.push({ key: pKey, parent: t, children });
      }
    }
    return { runningGroups: groups, totalSubagentsCount: subCount };
  }, [allThreads]);

  const [now, setNow] = useState(() => Date.now());
  const hasRunning = runningGroups.length > 0;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- 15s clock refresh only while tasks are running
  useEffect(() => {
    if (!hasRunning) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  const attentionRows = useMemo(() => {
    const out: Array<{
      readonly key: string;
      readonly thread: EnvironmentThreadShell;
      readonly kind: AttentionKind;
    }> = [];
    for (const t of allThreads) {
      if (t.archivedAt || t.settledAt || t.lineage?.parentThreadId) continue;
      const kind = getThreadAttentionKind(t, acknowledgedKeys, routeRowThreadKey);
      if (kind) {
        out.push({
          key: scopedThreadKey(scopeThreadRef(t.environmentId, t.id)),
          thread: t,
          kind,
        });
      }
    }
    return out;
  }, [allThreads, acknowledgedKeys, routeRowThreadKey]);

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
      for (const wf of result.value.workflows ?? []) {
        const statusStr = String((wf as { readonly status?: unknown }).status ?? "");
        const isActive =
          statusStr === "running" ||
          statusStr === "starting" ||
          statusStr === "waiting" ||
          statusStr === "paused" ||
          Boolean((wf as { readonly pendingQuestion?: unknown }).pendingQuestion);
        if (!isActive) continue;
        const runId = String((wf as { readonly runId?: unknown }).runId ?? "");
        if (!runId) continue;
        const rKey = `${environmentId}:${runId}`;
        if (seenRuns.has(rKey)) continue;
        seenRuns.add(rKey);
        const name = String(
          (wf as { readonly workflow?: unknown; readonly title?: unknown }).workflow ??
            (wf as { readonly title?: unknown }).title ??
            "工作流",
        );
        const needsYou = Boolean((wf as { readonly pendingQuestion?: unknown }).pendingQuestion);
        items.push({
          key: rKey,
          environmentId,
          runId,
          title: name,
          subtitle: needsYou ? "等待你的输入" : "运行中",
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

  const visibleRunningGroups = showAllRunning ? runningGroups : runningGroups.slice(0, 3);

  return (
    <li className="list-none px-1 pt-0.5 pb-1.5 select-none">
      <div className="space-y-1.5">
        {/* 1) 运行中 */}
        <div className="rounded-lg">
          {runningGroups.length === 0 ? (
            <div className="flex h-7 items-center justify-between px-2 text-xs text-sidebar-muted-foreground">
              <span>运行中 · 暂无运行任务</span>
              <span className="tabular-nums">0</span>
            </div>
          ) : (
            <div>
              <div className="flex h-7 items-center justify-between px-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRunningExpanded((v) => !v)}
                  className="inline-flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left font-medium text-sidebar-foreground"
                >
                  <ChevronDownIcon
                    className={cn(
                      "size-3.5 shrink-0 text-sidebar-muted-foreground transition-transform duration-150",
                      !runningExpanded && "-rotate-90",
                    )}
                  />
                  <span className="truncate">
                    运行中
                    {totalSubagentsCount > 0 ? (
                      <span className="font-normal text-sidebar-muted-foreground">
                        {" "}
                        · 含 {totalSubagentsCount} 个子任务
                      </span>
                    ) : null}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {runningGroups.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllRunning((v) => !v)}
                      className="cursor-pointer text-[11px] text-primary hover:underline"
                    >
                      {showAllRunning ? "收起" : "查看全部"}
                    </button>
                  ) : null}
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500/18 px-1.5 text-[11px] font-semibold text-sky-400 tabular-nums">
                    {runningGroups.length}
                  </span>
                </div>
              </div>

              {runningExpanded ? (
                <div className="mt-0.5 space-y-0.5 pl-1">
                  {visibleRunningGroups.map(({ key, parent, children }) => {
                    const ref = scopeThreadRef(parent.environmentId, parent.id);
                    const rowKey = scopedThreadKey(ref);
                    const isOpen = routeRowThreadKey === rowKey;
                    const projName =
                      projectDisplayNameByKey.get(`${parent.environmentId}:${parent.projectId}`) ??
                      null;
                    const elapsed = formatElapsedMinutes(parent.latestRun?.startedAt, now);
                    const subOpen = expandedParentIds.has(key);
                    return (
                      <div key={key} className="rounded-lg">
                        <div
                          className={cn(
                            "group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-sidebar-row-hover",
                            isOpen && "bg-sidebar-row-hover",
                          )}
                        >
                          <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-sky-400" />
                          <button
                            type="button"
                            onClick={() => onNavigateToThread(ref)}
                            className="min-w-0 flex-1 cursor-pointer text-left"
                          >
                            <div className="truncate font-medium text-sidebar-foreground">
                              {parent.title || "未命名会话"}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-sidebar-muted-foreground">
                              {projName ? <span>{projName} ·</span> : null}
                              <span>{elapsed || "执行中"}</span>
                            </div>
                          </button>
                          {children.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedParentIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  return next;
                                });
                              }}
                              className="inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded bg-muted/60 px-1.5 py-0.5 text-[10.5px] text-sidebar-muted-foreground hover:text-sidebar-foreground"
                            >
                              <span>{children.length} 子任务</span>
                              <ChevronRightIcon
                                className={cn(
                                  "size-3 transition-transform",
                                  subOpen && "rotate-90",
                                )}
                              />
                            </button>
                          ) : null}
                        </div>
                        {children.length > 0 && subOpen ? (
                          <div className="ml-4 space-y-0.5 border-l border-sidebar-border/70 pl-2">
                            {children.map((child) => {
                              const childRef = scopeThreadRef(child.environmentId, child.id);
                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => onNavigateToThread(childRef)}
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-[11.5px] text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
                                >
                                  <LoaderCircleIcon className="size-3 shrink-0 animate-spin text-sky-400" />
                                  <span className="min-w-0 flex-1 truncate">
                                    {child.title || "子任务"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* 2) 待处理 */}
        {attentionRows.length > 0 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 py-1">
            <button
              type="button"
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
                              setAcknowledgedKeys((prev) => new Set([...prev, key]));
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

        {/* 3) 工作流 */}
        {liveWorkflowItems.length > 0 ? (
          <div className="rounded-lg border border-sidebar-border/60 bg-sidebar/40 py-1">
            <button
              type="button"
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
 * Middle Tier in `所有项目`: `分类` Auto-Grouping Section
 */
export const StardustAllProjectsCategories = memo(function StardustAllProjectsCategories({
  activeThreads,
  routeRowThreadKey,
  projectDisplayNameByKey,
  renderThreadRow,
}: {
  readonly activeThreads: readonly EnvironmentThreadShell[];
  readonly routeRowThreadKey: string | null;
  readonly projectDisplayNameByKey: ReadonlyMap<string, string>;
  readonly renderThreadRow: (thread: EnvironmentThreadShell) => ReactNode;
}) {
  const settings = useStardustCategorySettings();
  const overrides = useThreadCategoryOverrides();
  const collapsedSet = useCollapsedCategories();
  const starredModels = useStarredSuggestionModels();

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
    for (const cat of visibleCategories) buckets.set(cat.id, []);

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
    }> = [];
    const empty: Array<(typeof visibleCategories)[number]> = [];

    const orderedCats = [
      ...visibleCategories.filter((c) => c.id === UNSORTED_CATEGORY_ID),
      ...visibleCategories.filter((c) => c.id !== UNSORTED_CATEGORY_ID),
    ];

    for (const cat of orderedCats) {
      const list = buckets.get(cat.id) ?? [];
      if (list.length > 0) {
        occupied.push({
          id: cat.id,
          label: cat.label,
          threads: list,
          hasRunning: list.some(isThreadActivelyRunning),
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
  }, [activeThreads, overrides, projectDisplayNameByKey, settings, visibleCategories]);

  if (!settings.enabled || settings.preset === "project") return null;

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
        const containsActiveRoute = sec.threads.some(
          (t) => scopedThreadKey(scopeThreadRef(t.environmentId, t.id)) === routeRowThreadKey,
        );
        const isCollapsed = collapsedSet.has(sec.id) && !containsActiveRoute;
        return (
          <li key={`cat-sec:${sec.id}`} className="list-none">
            <button
              type="button"
              onClick={() => toggleCategoryCollapsed(sec.id)}
              className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-row-hover select-none"
            >
              <ChevronDownIcon
                className={cn(
                  "size-3.5 shrink-0 text-sidebar-muted-foreground transition-transform duration-150",
                  isCollapsed && "-rotate-90",
                )}
              />
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sidebar-foreground/10 text-[11px] font-semibold text-sidebar-foreground/90">
                {pickCategoryGlyph(sec.label)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{sec.label}</span>
              {isCollapsed && sec.hasRunning ? (
                <span className="size-2 shrink-0 rounded-full bg-sky-400" />
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
            {emptyCategories.map((cat) => (
              <button
                key={`cat-empty:${cat.id}`}
                type="button"
                onClick={() => setCategorySettingsDialogOpen(true)}
                title="暂无匹配会话 · 点击管理分类关键词"
                className="flex h-7 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[12.5px] text-sidebar-muted-foreground/80 transition-colors hover:bg-sidebar-row-hover hover:text-sidebar-foreground"
              >
                <span className="size-2 shrink-0 rounded-full bg-sidebar-muted-foreground/45" />
                <span className="min-w-0 truncate">{cat.label}</span>
              </button>
            ))}
          </div>
        </li>
      ) : null}
    </>
  );
});
