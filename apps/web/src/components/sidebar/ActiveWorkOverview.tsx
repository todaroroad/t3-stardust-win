import { InboxQuickActions } from "./InboxQuickActions";
import { inboxLabel } from "~/i18n/inboxLabel";
import { uiText } from "../../i18n";
import { useUiText } from "~/i18n/useUiText";
import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { SidebarThreadSummary } from "../../types";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import {
  activeWorkElapsed,
  activeWorkStatus,
  collectActiveWork,
  activeWorkPreview,
} from "../../sidebarActiveWork";
import { subtaskThreadKey } from "../../sidebarSubtasks";
import { sidebarProviderLabel } from "../../sidebarProviderGrouping";
import { sidebarRelativeTime } from "../../sidebarInboxPresentation";
import { useNowMinute } from "../../hooks/useNowMinute";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { Button } from "../ui/button";
import { Popover, PopoverTrigger, PopoverPopup, PopoverTitle } from "../ui/popover";
import { useQuietThreadProjection, useThreadShell } from "../../state/entities";
import { useEnvironment } from "../../state/environments";
import { taskProgressSnapshot } from "../../taskProgress";

import { cn } from "~/lib/utils";
import { progressTone, taskProgressStateLabels } from "../chat/TaskProgressSteps";

/**
 * The open thread's plan as a thin bar and `done/total · state`. Only the open thread: its detail
 * is already subscribed by the chat view, so the sidebar adds no stream of its own.
 */
function ActiveWorkProgress({
  thread,
  fallback,
}: {
  thread: SidebarThreadSummary;
  fallback: string;
}) {
  const uiText = useUiText();
  const threadRef = scopeThreadRef(thread.environmentId, thread.id);
  const projection = useQuietThreadProjection(threadRef)?.projection ?? null;
  const shell = useThreadShell(threadRef);
  const environment = useEnvironment(thread.environmentId);
  const progress = taskProgressSnapshot(
    projection,
    shell,
    environment?.connection.phase === "connected",
  );
  if (progress.total === 0) {
    return (
      <span className="block truncate pl-3 text-2xs text-sidebar-muted-foreground">{fallback}</span>
    );
  }
  const stateLabel = uiText(
    progress.stale ? "Status may be out of date" : taskProgressStateLabels[progress.state],
  );
  return (
    <span className="flex min-w-0 items-center gap-1.5 pl-3 text-2xs text-sidebar-muted-foreground">
      <span
        aria-hidden
        className="block h-0.75 w-11 shrink-0 overflow-hidden rounded-full bg-sidebar-border"
      >
        <span
          className={cn(
            "block h-full origin-left rounded-full bg-current transition-transform duration-500 ease-out motion-reduce:transition-none",
            progressTone(progress),
          )}
          style={{ transform: `scaleX(${progress.completed / progress.total})` }}
        />
      </span>
      <span className="min-w-0 truncate tabular-nums">
        {progress.completed}/{progress.total} ·{" "}
        <span className={progressTone(progress)}>{stateLabel}</span>
      </span>
    </span>
  );
}

function activeWorkProjectNames(projects: readonly SidebarProjectSnapshot[]) {
  const result = new Map<string, string>();
  for (const project of projects)
    for (const key of project.providerThreadKeys ?? []) result.set(key, project.displayName);
  return result;
}

export function ActiveWorkOverview({
  threads,
  projects,
  activeKey,
  navigate,
  incomplete = false,
}: {
  threads: readonly SidebarThreadSummary[];
  projects: readonly SidebarProjectSnapshot[];
  activeKey: string | null;
  navigate: (ref: ScopedThreadRef) => void;
  incomplete?: boolean;
}) {
  const text = useUiText();
  const groups = collectActiveWork(threads);
  // The shared minute clock; it only ticks while something subscribes and adds no timer here.
  const nowMs = Date.parse(`${useNowMinute()}:00Z`);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const projectByThread = activeWorkProjectNames(projects);
  const childCount = groups.reduce((count, group) => count + group.children.length, 0);
  const preview = activeWorkPreview(groups);
  const truncated =
    preview.length < groups.length ||
    preview.some((group, index) => group.children.length < groups[index]!.children.length);
  const go = (thread: SidebarThreadSummary) => {
    navigate(scopeThreadRef(thread.environmentId, thread.id));
    setOpen(false);
  };
  const row = (thread: SidebarThreadSummary, fallback?: string) => {
    const key = subtaskThreadKey(thread);
    const status = activeWorkStatus(thread) ?? fallback;
    const attention = status === "待授权" || status === "待回答";
    const startedAt = thread.runtime?.activityStartedAt ?? null;
    const provider = sidebarProviderLabel(
      thread.runtime?.providerInstanceId ?? thread.modelSelection.instanceId,
    );
    // Second line, as in the mockup: state first, then how long it has been running.
    const detail = [
      status ? inboxLabel(status) : status,
      startedAt ? activeWorkElapsed(startedAt, nowMs) : null,
      provider,
    ]
      .filter(Boolean)
      .join(" · ");
    const tooltip = [provider, projectByThread.get(key), status ? inboxLabel(status) : status]
      .filter(Boolean)
      .join(" · ");
    return (
      <span className="group/inbox-row relative flex min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => go(thread)}
                aria-current={activeKey === key ? "page" : undefined}
                className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:bg-accent"
              >
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 text-xs",
                    // V14: the hover actions take this space instead of covering the title.
                    attention
                      ? "group-hover/inbox-row:pe-18"
                      : "group-hover/inbox-row:pe-12.5",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${attention ? "bg-warning" : "bg-primary"}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {thread.title || uiText("Untitled thread")}
                  </span>
                  <span className="shrink-0 text-2xs tabular-nums text-sidebar-muted-foreground group-hover/inbox-row:hidden">
                    {sidebarRelativeTime(thread.runtime?.activityStartedAt ?? thread.updatedAt)}
                  </span>
                </span>
                {activeKey === key ? (
                  <ActiveWorkProgress thread={thread} fallback={detail} />
                ) : (
                  <span className="block truncate pl-3 text-2xs text-sidebar-muted-foreground">
                    {detail}
                  </span>
                )}
              </button>
            }
          />
          <TooltipPopup side="right">
            {thread.title || uiText("Untitled thread")}
            <br />
            {tooltip}
          </TooltipPopup>
        </Tooltip>
        <InboxQuickActions
          mode={attention ? "needs-you" : "running"}
          threadRef={scopeThreadRef(thread.environmentId, thread.id)}
          title={thread.title}
          onOpen={() => go(thread)}
        />
      </span>
    );
  };
  const renderGroups = (all: boolean) => (
    <ul
      aria-label={all ? uiText("All active tasks") : uiText("Active tasks")}
      className="space-y-0.5"
    >
      {(all ? groups : preview).map(({ root, children }) => {
        const key = subtaskThreadKey(root);
        const expanded = all || !collapsed.has(key);
        return (
          <li key={key}>
            <div className="flex min-w-0 items-center">
              {children.length && !all ? (
                <button
                  type="button"
                  aria-label={uiText("{action} subtasks for {title}", {
                    action: expanded ? uiText("Collapse recommendation") : uiText("Expand"),
                    title: root.title,
                  })}
                  aria-expanded={expanded}
                  onClick={() =>
                    setCollapsed((previous) => {
                      const next = new Set(previous);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  className="shrink-0 rounded p-0.5 text-sidebar-muted-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {expanded ? (
                    <ChevronDownIcon className="size-3" />
                  ) : (
                    <ChevronRightIcon className="size-3" />
                  )}
                </button>
              ) : null}
              {row(
                root,
                children.length
                  ? children.length === 1
                    ? uiText("Waiting for {count} subtask", { count: children.length })
                    : uiText("Waiting for {count} subtasks", { count: children.length })
                  : undefined,
              )}
            </div>
            {expanded && children.length ? (
              <ul
                className="ml-3 border-l border-sidebar-border pl-1"
                aria-label={uiText("{title}’s active subtasks", { title: root.title })}
              >
                {children.map((child) => (
                  <li key={subtaskThreadKey(child)} className="flex min-w-0">
                    {row(child)}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
  return (
    <section
      aria-label={text("Running tasks overview")}
      className="pb-1.5"
      data-sidebar-cap-section=""
    >
      <div
        className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-2xs tracking-wider text-sidebar-muted-foreground"
        data-sidebar-cap=""
      >
        <span>{text("Running")}</span>
        {groups.length === 0 ? (
          <span className="tracking-normal">
            <span aria-hidden>· </span>
            <span>{text("No active tasks")}</span>
          </span>
        ) : childCount ? (
          <span className="tracking-normal">
            {uiText("· Includes ")}
            {childCount} {uiText(" subtasks")}
          </span>
        ) : null}
        <span className="ml-auto tracking-normal tabular-nums">{groups.length}</span>
      </div>
      {incomplete ? (
        <p role="status" className="px-2 text-3xs text-sidebar-muted-foreground">
          {uiText("Connection pending. Some statuses may be out of date.")}
        </p>
      ) : null}
      {groups.length === 0 ? null : renderGroups(false)}
      {truncated ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button variant="ghost" size="xs" />}>
            {uiText("View all ")}
            {groups.length + childCount} {uiText(" items")}
          </PopoverTrigger>
          <PopoverPopup side="right" align="start" width="lg" padding="compact">
            <PopoverTitle>
              {uiText("In progress · ")}
              {groups.length} {uiText(" main tasks, ")}
              {childCount} {uiText(" subtasks")}
            </PopoverTitle>
            <div className="mt-2 max-h-[min(65vh,640px)] overflow-y-auto">{renderGroups(true)}</div>
          </PopoverPopup>
        </Popover>
      ) : null}
    </section>
  );
}
