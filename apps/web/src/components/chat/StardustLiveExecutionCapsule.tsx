import type { EnvironmentThreadShell, ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { OrchestrationV2RunStatus, OrchestrationV2TurnItem } from "@t3tools/contracts";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleDotIcon,
  FileCode2Icon,
  FolderSearchIcon,
  GlobeIcon,
  LoaderCircleIcon,
  TerminalIcon,
  WorkflowIcon,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "~/lib/utils";

const ACTIVE_RUN_STATUSES = new Set<OrchestrationV2RunStatus>([
  "preparing",
  "starting",
  "running",
  "waiting",
]);

interface CapsuleActionEntry {
  readonly id: string;
  readonly kind: "search" | "command" | "edit" | "web" | "subagent" | "plan";
  readonly title: string;
  readonly detail?: string | undefined;
  readonly status: "running" | "done" | "failed";
}

interface CapsuleActionGroup {
  readonly id: string;
  readonly kind: CapsuleActionEntry["kind"];
  readonly title: string;
  readonly status: "running" | "done" | "failed";
  readonly items: readonly CapsuleActionEntry[];
}

function shortPathLabel(raw: string): string {
  const cleaned = raw.replace(/\\/g, "/").trim();
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length <= 2) return cleaned;
  return `${parts.at(-2)}/${parts.at(-1)}`;
}

function summarizeTurnItem(item: OrchestrationV2TurnItem): CapsuleActionEntry | null {
  const done = item.completedAt != null;
  switch (item.type) {
    case "file_search": {
      const pattern = item.pattern?.trim() || "workspace";
      return {
        id: item.id,
        kind: "search",
        title: `Searched ${pattern}`,
        detail: item.results ? `${item.results.length} matches` : undefined,
        status: done ? "done" : "running",
      };
    }
    case "web_search": {
      const q = item.patterns?.[0]?.trim() || "web";
      return {
        id: item.id,
        kind: "web",
        title: `Web search: ${q}`,
        status: done ? "done" : "running",
      };
    }
    case "file_change": {
      return {
        id: item.id,
        kind: "edit",
        title: `Edited ${shortPathLabel(item.fileName)}`,
        detail:
          item.additions != null || item.deletions != null
            ? `+${item.additions ?? 0} -${item.deletions ?? 0}`
            : undefined,
        status: done ? "done" : "running",
      };
    }
    case "command_execution": {
      const firstLine = (item.input || "").trim().split(/\r?\n/)[0]?.slice(0, 72) || "command";
      const failed = item.outputIndicatesFailure === true || (item.exitCode != null && item.exitCode !== 0);
      return {
        id: item.id,
        kind: "command",
        title: firstLine,
        detail: item.exitCode != null ? `exit ${item.exitCode}` : undefined,
        status: !done ? "running" : failed ? "failed" : "done",
      };
    }
    case "subagent": {
      const firstLine = (item.progress || item.prompt || "Subagent task")
        .trim()
        .split(/\r?\n/)[0]
        ?.slice(0, 72);
      return {
        id: item.id,
        kind: "subagent",
        title: firstLine || "Subagent task",
        status: done ? "done" : "running",
      };
    }
    case "dynamic_tool": {
      const tool = item.toolName || "tool";
      const inp =
        item.input && typeof item.input === "object" && !Array.isArray(item.input)
          ? (item.input as Record<string, unknown>)
          : null;
      const targetPath =
        typeof inp?.Path === "string"
          ? shortPathLabel(inp.Path)
          : typeof inp?.path === "string"
            ? shortPathLabel(inp.path)
            : typeof inp?.toolSummary === "string"
              ? inp.toolSummary
              : typeof inp?.CommandLine === "string"
                ? inp.CommandLine.trim().split(/\r?\n/)[0]?.slice(0, 56)
                : typeof inp?.query === "string"
                  ? inp.query
                  : "";
      let kind: CapsuleActionEntry["kind"] = "command";
      let title = targetPath ? `${tool}: ${targetPath}` : tool;
      if (/search|grep|find|read_file/i.test(tool)) {
        kind = "search";
        title =
          tool === "read_file" && targetPath
            ? `Read ${targetPath}`
            : targetPath
              ? `Searched ${targetPath}`
              : `Inspected files`;
      } else if (/edit_file|write_file/i.test(tool)) {
        kind = "edit";
        title = targetPath ? `Updated ${targetPath}` : "Updated file";
      } else if (/web/i.test(tool)) {
        kind = "web";
      } else if (/subagent|delegate/i.test(tool)) {
        kind = "subagent";
      }
      return {
        id: item.id,
        kind,
        title,
        status: done ? "done" : "running",
      };
    }
    default:
      return null;
  }
}

function groupConsecutiveEntries(entries: readonly CapsuleActionEntry[]): readonly CapsuleActionGroup[] {
  const groups: CapsuleActionGroup[] = [];
  for (const entry of entries) {
    const prev = groups.at(-1);
    if (
      prev &&
      prev.kind === entry.kind &&
      prev.status === entry.status &&
      prev.status === "done" &&
      (entry.kind === "search" || entry.kind === "edit" || entry.kind === "command")
    ) {
      groups[groups.length - 1] = {
        ...prev,
        title: entry.title,
        items: [...prev.items, entry],
      };
    } else {
      groups.push({
        id: entry.id,
        kind: entry.kind,
        title: entry.title,
        status: entry.status,
        items: [entry],
      });
    }
  }
  return groups;
}

function GroupKindIcon({
  kind,
  status,
}: {
  readonly kind: CapsuleActionEntry["kind"];
  readonly status: CapsuleActionEntry["status"];
}) {
  if (status === "running") {
    return <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-sky-400" />;
  }
  if (status === "failed") {
    return <CircleDotIcon className="size-3.5 shrink-0 text-destructive" />;
  }
  switch (kind) {
    case "search":
      return <FolderSearchIcon className="size-3.5 shrink-0 text-emerald-400" />;
    case "edit":
      return <FileCode2Icon className="size-3.5 shrink-0 text-emerald-400" />;
    case "web":
      return <GlobeIcon className="size-3.5 shrink-0 text-emerald-400" />;
    case "subagent":
      return <WorkflowIcon className="size-3.5 shrink-0 text-emerald-400" />;
    default:
      return <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-400" />;
  }
}

export const StardustLiveExecutionCapsule = memo(function StardustLiveExecutionCapsule({
  projection,
  shell,
  isDraftHeroState,
}: {
  readonly projection: ThreadStructure | null | undefined;
  readonly shell: EnvironmentThreadShell | null | undefined;
  readonly isDraftHeroState?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<string>>(() => new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const activeRun = useMemo(() => {
    if (!projection?.runs.length) return null;
    return (
      projection.runs.findLast((r) => ACTIVE_RUN_STATUSES.has(r.status)) ??
      projection.runs.at(-1) ??
      null
    );
  }, [projection?.runs]);

  const isRunning = Boolean(
    (activeRun && ACTIVE_RUN_STATUSES.has(activeRun.status)) ||
      shell?.runtime?.status === "running" ||
      shell?.runtime?.status === "starting" ||
      shell?.runtime?.status === "preparing" ||
      (shell?.pendingBackgroundTasks?.length ?? 0) > 0,
  );

  const { groups, todoSteps, completedCount, latestTitle } = useMemo(() => {
    if (!projection || !activeRun) {
      return {
        groups: [] as readonly CapsuleActionGroup[],
        todoSteps: [] as ReadonlyArray<{ readonly step: string; readonly status: string }>,
        completedCount: 0,
        latestTitle: "",
      };
    }
    const runItems = projection.turnItems.filter((item) => item.runId === activeRun.id);
    const latestTodo = runItems.findLast((item) => item.type === "todo_list");
    const steps =
      latestTodo && latestTodo.type === "todo_list"
        ? latestTodo.steps.map((s) => ({ step: s.step, status: s.status }))
        : [];
    const entries = runItems
      .map(summarizeTurnItem)
      .filter((entry): entry is CapsuleActionEntry => entry !== null);
    const grouped = groupConsecutiveEntries(entries);
    const doneTotal = entries.filter((e) => e.status === "done").length;
    const activeStep = steps.find((s) => s.status === "in_progress");
    const lastEntry = entries.at(-1);
    const headline =
      activeStep?.step ||
      lastEntry?.title ||
      (isRunning ? "正在分析并执行任务步骤…" : "");
    return {
      groups: grouped,
      todoSteps: steps,
      completedCount: doneTotal,
      latestTitle: headline,
    };
  }, [projection, activeRun, isRunning]);

  // Close floating panel on Escape or outside pointerdown
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Escape/outside-click dismissal for floating panel
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Auto-collapse when switching threads
  const threadId = shell?.id ?? projection?.thread.id ?? null;
  const prevThreadIdRef = useRef(threadId);
  if (prevThreadIdRef.current !== threadId) {
    prevThreadIdRef.current = threadId;
    if (open) setOpen(false);
  }

  if (isDraftHeroState) return null;
  if (!isRunning && !open) return null;
  if (groups.length === 0 && todoSteps.length === 0 && !isRunning) return null;

  const toggleGroup = (id: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      ref={containerRef}
      data-t3m-execution-capsule="true"
      className="pointer-events-auto relative z-20 mb-2 select-none"
    >
      {open ? (
        <div
          role="dialog"
          aria-label="实时执行动态"
          className="absolute inset-x-0 bottom-[calc(100%+6px)] z-30 flex max-h-72 flex-col overflow-hidden rounded-2xl border border-border/80 bg-popover/96 text-popover-foreground shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <TerminalIcon className="size-3.5 text-sky-400" />
              <span>实时执行动态</span>
              {completedCount > 0 ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                  已完成 {completedCount} 项
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span>收起</span>
              <kbd className="rounded border border-border/80 bg-muted/70 px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                esc
              </kbd>
            </button>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto px-2.5 py-2 text-xs">
            {todoSteps.length > 0 ? (
              <div className="mb-1.5 space-y-1 rounded-xl border border-border/50 bg-muted/30 p-2">
                {todoSteps.map((step, idx) => (
                  <div key={`${idx}:${step.step}`} className="flex items-center gap-2 px-1 py-0.5">
                    {step.status === "completed" ? (
                      <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-400" />
                    ) : step.status === "in_progress" ? (
                      <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-sky-400" />
                    ) : (
                      <span className="size-2 shrink-0 rounded-full bg-muted-foreground/45" />
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        step.status === "completed"
                          ? "text-muted-foreground"
                          : "font-medium text-foreground",
                      )}
                    >
                      {step.step}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {groups.map((group) => {
              const isMulti = group.items.length > 1;
              const isGroupExpanded = expandedGroupIds.has(group.id);
              return (
                <div key={group.id} className="rounded-lg">
                  <button
                    type="button"
                    disabled={!isMulti}
                    onClick={() => isMulti && toggleGroup(group.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                      isMulti ? "cursor-pointer hover:bg-muted/65" : "cursor-default",
                    )}
                  >
                    <GroupKindIcon kind={group.kind} status={group.status} />
                    <span className="min-w-0 flex-1 truncate text-foreground/92">
                      {group.title}
                    </span>
                    {isMulti ? (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums">
                        {group.items.length} 个操作
                        <ChevronRightIcon
                          className={cn(
                            "size-3.5 transition-transform duration-150",
                            isGroupExpanded && "rotate-90",
                          )}
                        />
                      </span>
                    ) : group.items[0]?.detail ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {group.items[0].detail}
                      </span>
                    ) : null}
                  </button>
                  {isMulti && isGroupExpanded ? (
                    <div className="ml-5 space-y-0.5 border-l border-border/60 pl-2.5 pb-1">
                      {group.items.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between gap-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          <span className="min-w-0 truncate">{sub.title}</span>
                          {sub.detail ? (
                            <span className="shrink-0 tabular-nums">{sub.detail}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/25 px-3.5 py-1.5 text-[11.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-2 font-medium text-foreground/90">
              {isRunning ? (
                <LoaderCircleIcon className="size-3.5 animate-spin text-sky-400" />
              ) : (
                <CheckCircle2Icon className="size-3.5 text-emerald-400" />
              )}
              <span>{isRunning ? "任务步骤执行中" : "本轮任务步骤已完成"}</span>
            </span>
            {(shell?.pendingBackgroundTasks?.length ?? 0) > 0 ? (
              <span className="text-[11px] text-sky-400 tabular-nums">
                {shell!.pendingBackgroundTasks.length} 个后台进程
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Normal-flow minimized bar inside data-chat-composer-overlay: ResizeObserver reserves exact height so chat text is NEVER occluded */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-8 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-card/88 px-3 text-xs text-foreground shadow-xs backdrop-blur-md transition-colors duration-150 hover:border-border hover:bg-card"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {isRunning ? (
            <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-sky-400" />
          ) : (
            <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-400" />
          )}
          <span className="min-w-0 truncate font-medium text-foreground/92">
            {latestTitle || "实时执行动态"}
          </span>
          {completedCount > 0 ? (
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
              · {completedCount} 步
            </span>
          ) : null}
        </span>
        <ChevronUpIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180 text-foreground",
          )}
        />
      </button>
    </div>
  );
});
