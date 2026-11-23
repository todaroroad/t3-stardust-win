import { uiText } from "../../i18n";
import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import { useNowMinute } from "../../hooks/useNowMinute";
import { type BoardTask } from "../../taskBoard.logic";
import {
  boardResumeReason,
  boardResumeToken,
  linkedBoardThread,
  threadResumeToken,
  resumeRequestHidden,
} from "../../resumeCard";
import { useResumeCardStore } from "../../resumeCardStore";
import { InboxProgress } from "./InboxProgress";
import { useTaskBoard, type InboxThreadRequest } from "../../taskBoard";
import { useAtomValue } from "@effect/atom-react";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { resolveShortcutCommand, shortcutLabelForCommand } from "../../keybindings";
import { isTerminalFocused } from "../../lib/terminalFocus";
import { isEditableFocused } from "../../lib/editableFocus";
import { isCommandPaletteOpen } from "../../commandPaletteBus";
import { isModelPickerOpen } from "../../modelPickerVisibility";
import { sidebarProviderLabel } from "../../sidebarProviderGrouping";
import { useEffect, useRef, useState } from "react";
import { BookmarkIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { SidebarThreadSummary } from "../../types";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { useAllEnvironmentShellsBootstrapped } from "../../state/entities";
import { useEnvironments } from "../../state/environments";
import { useUiStateStore } from "../../uiStateStore";
import {
  inboxReason,
  inboxThreadKey,
  resumableThreads,
  resumeVisits,
  shouldShowInboxRow,
  inboxHoldsBackgroundWork,
} from "../../workbenchInbox";
import { useWorkbenchInboxStore } from "../../workbenchInboxStore";
import {
  nextAttentionThread,
  attentionThreadLabel,
  attentionPage,
  attentionTimestamp,
  sortedAttentionThreads,
  sidebarRelativeTime,
} from "../../sidebarInboxPresentation";
import { useInboxCountBounce, useInboxExitRows } from "~/lib/workbenchMotion";
import { ActiveWorkOverview } from "./ActiveWorkOverview";
import { InboxQuickActions, InboxStatusDot } from "./InboxQuickActions";
import { useThreadActions } from "../../hooks/useThreadActions";
import { cn } from "../../lib/utils";
import { onOpenRecentWork } from "../../workbenchNavigation";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import { Button } from "../ui/button";
import { Dialog, DialogPopup, DialogTitle, DialogClose } from "../ui/dialog";
import { SidebarMenu, SidebarMenuItem } from "../ui/sidebar";

// Read the clock only from event handlers and the committed-navigation effect.
const visitTimestamp = () => new Date().toISOString();

export function WorkbenchInbox({
  threads,
  projects,
  activeKey,
  navigate,
}: {
  threads: readonly SidebarThreadSummary[];
  projects: readonly SidebarProjectSnapshot[];
  activeKey: string | null;
  navigate: (ref: ScopedThreadRef) => void;
}) {
  const boardTasks = useTaskBoard((s) => (s.error ? null : s.data));
  const hidden = useResumeCardStore((state) => state.hidden);
  const selected = useResumeCardStore((state) => state.selected);
  const hiddenUntil = useResumeCardStore((state) => state.hiddenUntil);
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);
  const boardAttention =
    boardTasks?.tasks.filter(
      (task) =>
        !task.snoozed &&
        (task.state === "user" || task.state === "blocked") &&
        linkedBoardThread(task, threads) !== null &&
        !resumeRequestHidden(
          `board:${task.folder}`,
          boardResumeToken(task),
          hidden,
          hiddenUntil,
          now,
        ),
    ) ?? [];
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const nextShortcut = shortcutLabelForCommand(keybindings, "inbox.next");
  const [view, setView] = useState<"resume" | null>(null);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [showDoneToday, setShowDoneToday] = useState(false);
  const { settleThread, unsettleThread, markThreadUnread } = useThreadActions();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Subscribe to the command that opens the recent-work dialog.
  useEffect(() => onOpenRecentWork(() => setView("resume")), []);
  const visitThread = useAtomCommand(threadEnvironment.visit, { reportFailure: false });
  const [storageError, setStorageError] = useState(false);
  const { saved, visits, acknowledgedErrors, update } = useWorkbenchInboxStore();
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const { environments, isReady } = useEnvironments();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const incomplete =
    !bootstrapped ||
    !isReady ||
    environments.length === 0 ||
    environments.some((environment) => environment.connection.phase !== "connected");
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Persist the visit only after navigation commits to the active thread.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Display a failed persistence write without recording visits during render.
    if (activeKey) setStorageError(!update("visits", activeKey, visitTimestamp()));
  }, [activeKey, update]);
  const projectByThread = (() => {
    const result = new Map<string, SidebarProjectSnapshot>();
    for (const project of projects)
      for (const key of project.providerThreadKeys ?? []) result.set(key, project);
    return result;
  })();
  const reasons = (() =>
    new Map(
      threads.map((thread) => [
        inboxThreadKey(thread),
        inboxReason(thread, localVisits[inboxThreadKey(thread)]),
      ]),
    ))();
  // Opening a result updates the normal unread watermark, but only an explicit action
  // resolves Needs you. Retain the exact observed turn, never an older or running turn.
  const retained = threads.filter((thread) => {
    const request = selected[inboxThreadKey(thread)];
    return (
      request?.reason === "有新结果" &&
      !request.boardFolder &&
      // Sub-agent results belong to the parent thread; also clears items recorded before this rule.
      thread.lineage.relationshipToParent !== "subagent" &&
      !thread.deletedAt &&
      !thread.archivedAt &&
      thread.latestRun?.status === "completed" &&
      !inboxHoldsBackgroundWork(thread) &&
      request.token === threadResumeToken(thread, request.reason)
    );
  });
  for (const thread of retained) reasons.set(inboxThreadKey(thread), "有新结果");
  const unread = sortedAttentionThreads(threads, acknowledgedErrors, localVisits);
  const attention = [
    ...unread,
    ...retained.filter(
      (thread) => !unread.some((item) => inboxThreadKey(item) === inboxThreadKey(thread)),
    ),
  ].filter(
    (thread) =>
      !effectiveSnoozed(thread, { now: `${nowMinute}:00Z` }) &&
      !resumeRequestHidden(
        inboxThreadKey(thread),
        threadResumeToken(thread, reasons.get(inboxThreadKey(thread)) ?? "有新结果"),
        hidden,
        hiddenUntil,
        now,
      ),
  );
  const attentionKeys = new Set(attention.map(inboxThreadKey));
  const today = new Date(now).toDateString();
  const doneToday = threads
    .filter(
      (thread) =>
        thread.settledOverride === "settled" &&
        thread.settledAt !== null &&
        new Date(thread.settledAt).toDateString() === today &&
        !thread.archivedAt &&
        !thread.deletedAt &&
        thread.lineage.relationshipToParent !== "subagent" &&
        !attentionKeys.has(inboxThreadKey(thread)),
    )
    .toSorted((a, b) => Date.parse(b.settledAt ?? "") - Date.parse(a.settledAt ?? ""));
  const resumeRequest = (thread: SidebarThreadSummary) => {
    const key = inboxThreadKey(thread);
    const reason = reasons.get(key) ?? "有新结果";
    return {
      key,
      token: threadResumeToken(thread, reason),
      ref: scopeThreadRef(thread.environmentId, thread.id),
      title: thread.title,
      reason,
    };
  };
  const openThread = (thread: SidebarThreadSummary) => {
    const request = resumeRequest(thread);
    useResumeCardStore.getState().open(request);
    navigate(request.ref);
  };
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep the inbox keyboard shortcut listener in sync with current actionable threads.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isCommandPaletteOpen() || isModelPickerOpen())
        return;
      const command = resolveShortcutCommand(event, keybindings, {
        context: {
          terminalFocus: isTerminalFocused(),
          editableFocus: isEditableFocused(event.target),
        },
      });
      if (command !== "inbox.next") return;
      const target = nextAttentionThread(attention, activeKey);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      const reason = reasons.get(inboxThreadKey(target)) ?? "有新结果";
      const ref = scopeThreadRef(target.environmentId, target.id);
      useResumeCardStore.getState().open({
        key: inboxThreadKey(target),
        token: threadResumeToken(target, reason),
        ref,
        title: target.title,
        reason,
      });
      navigate(ref);
    };
    // Handle inbox navigation before rich-text keymaps consume shifted Mod-I.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [attention, activeKey, keybindings, navigate, reasons]);
  // Same rule as the right-panel "待回复" tab: things that need an answer, not unread results.
  const requestCount =
    attention.filter((thread) => reasons.get(inboxThreadKey(thread)) !== "有新结果").length +
    boardAttention.length;
  const badgeRef = useInboxCountBounce(requestCount);
  const requests: InboxThreadRequest[] = attention.map((thread) => {
    const key = inboxThreadKey(thread);
    const reason = reasons.get(key) ?? "有新结果";
    const project = projectByThread.get(key);
    const label = attentionThreadLabel(thread, threads, reason);
    return {
      key,
      ref: scopeThreadRef(thread.environmentId, thread.id),
      title: label.title,
      reason,
      place:
        label.detail ??
        `${project?.displayName ?? uiText("Project")} · ${project?.providerLabel ?? sidebarProviderLabel(thread.modelSelection.instanceId)}`,
      dismissLabel:
        reason === "运行失败"
          ? uiText("Acknowledged")
          : reason === "有新结果"
            ? uiText("Seen")
            : null,
      dismiss:
        reason === "运行失败"
          ? () => change("acknowledgedErrors", thread, thread.latestRun?.runId ?? null)
          : reason === "有新结果"
            ? () => void markSeen(thread)
            : null,
    };
  });
  const requestSignature = JSON.stringify(
    requests.map((request) => [request.key, request.reason, request.title, request.place]),
  );
  const publishedSignature = useRef<string | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Publish conversation requests to the right-panel inbox whenever their visible content changes.
  useEffect(() => {
    if (publishedSignature.current === requestSignature) return;
    publishedSignature.current = requestSignature;
    useTaskBoard.setState({ threadRequests: requests });
  });
  const markSeen = async (thread: SidebarThreadSummary) => {
    const request = resumeRequest(thread);
    const visitedAt = visitTimestamp();
    const result = await visitThread({
      environmentId: thread.environmentId,
      input: { threadId: thread.id, visitedAt },
    });
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) setStorageError(true);
      return;
    }
    useUiStateStore.getState().markThreadVisited(request.key, visitedAt);
    useResumeCardStore.getState().hide(request);
    setStorageError(!update("visits", request.key, visitedAt));
  };
  // V14: "done" clears the row (seen / acknowledged) and settles the thread so it lists under
  // "Done today"; a later run un-settles it on the server and it comes back on its own.
  const completeThread = (thread: SidebarThreadSummary, failed: boolean) => {
    if (failed) change("acknowledgedErrors", thread, thread.latestRun?.runId ?? null);
    else void markSeen(thread);
    void settleThread(scopeThreadRef(thread.environmentId, thread.id));
  };
  const reopenThread = (thread: SidebarThreadSummary) => {
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    void (async () => {
      await unsettleThread(ref);
      markThreadUnread(ref);
    })();
  };
  const visitHistory = (() => resumeVisits(threads, localVisits, visits))();
  const recent = (() => resumableThreads(threads, visitHistory, saved))();
  const current = threads.find((thread) => inboxThreadKey(thread) === activeKey);
  const change = (
    field: "saved" | "acknowledgedErrors",
    thread: SidebarThreadSummary,
    value: string | null,
  ) => setStorageError(!update(field, inboxThreadKey(thread), value));
  const renderRows = (items: readonly SidebarThreadSummary[]) =>
    items.map((thread) => {
      const key = inboxThreadKey(thread);
      const project = projectByThread.get(key);
      const isSaved = Boolean(saved[key]);
      return (
        <li key={key} className="flex items-start gap-1 rounded-md p-1 hover:bg-accent/50">
          <button
            type="button"
            className="min-w-0 flex-1 rounded-md p-1 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => {
              navigate(scopeThreadRef(thread.environmentId, thread.id));
              setView(null);
            }}
          >
            <span className="block break-words text-sm font-medium">
              {thread.title || uiText("Untitled thread")}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {project?.displayName ?? uiText("Project")} ·{" "}
              {project?.providerLabel ?? thread.modelSelection.instanceId}
              {thread.lineage.relationshipToParent === "subagent" ? uiText(" · Subtask") : ""}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {isSaved ? uiText("Saved for later") : uiText("Recently visited")} ·{" "}
              {sidebarRelativeTime(visitHistory[key] ?? saved[key] ?? thread.updatedAt)}
            </span>
          </button>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Button
              size="icon"
              variant={isSaved ? "secondary" : "ghost"}
              aria-label={isSaved ? uiText("Remove saved conversation") : uiText("Saved for later")}
              aria-pressed={isSaved}
              title={isSaved ? uiText("Remove saved conversation") : uiText("Saved for later")}
              onClick={() => change("saved", thread, isSaved ? null : visitTimestamp())}
            >
              <BookmarkIcon />
            </Button>
          </div>
        </li>
      );
    });
  const section = (title: string, items: readonly SidebarThreadSummary[], empty: string) => (
    <section className="space-y-1">
      <h3 className="text-sm font-medium">
        {title} <span className="text-muted-foreground">{items.length}</span>
      </h3>
      {items.length ? (
        <ul className="space-y-1">{renderRows(items)}</ul>
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </section>
  );
  const panel = (
    <DialogPopup showCloseButton={false}>
      <div className="p-4">
        <div className="mb-3 border-b px-1 pb-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>{uiText("Recent and saved for later")}</DialogTitle>
            <DialogClose
              render={<Button variant="ghost" size="icon" aria-label={uiText("Close panel")} />}
            >
              <XIcon />
            </DialogClose>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {uiText("Find recently visited or saved conversations.")}
          </p>
        </div>
        <div className="max-h-[min(65vh,640px)] space-y-4 overflow-y-auto px-1 pb-2">
          {incomplete ? (
            <p role="status" className="rounded-md border p-3 text-sm">
              {uiText("Some connections are still starting. Cached results may be incomplete.")}
            </p>
          ) : null}
          {storageError ? (
            <p role="alert" className="text-sm text-destructive">
              {uiText("Couldn’t save locally. Check browser storage and try again.")}
            </p>
          ) : null}

          <>
            {current ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  change("saved", current, saved[inboxThreadKey(current)] ? null : visitTimestamp())
                }
              >
                {saved[inboxThreadKey(current)]
                  ? uiText("Stop saving this conversation")
                  : uiText("Save this conversation for later")}
              </Button>
            ) : null}
            {section(
              uiText("Saved for later"),
              recent.filter((thread) => saved[inboxThreadKey(thread)]),
              uiText("Bookmark work to return to it later. Remove the bookmark anytime."),
            )}
            {section(
              uiText("Recently visited"),
              recent.filter((thread) => !saved[inboxThreadKey(thread)]).slice(0, 20),
              uiText("Conversations you open appear here."),
            )}
            <p className="text-xs text-muted-foreground">
              {uiText(
                "Bookmarks and visits are saved on this device and leave task completion unchanged.",
              )}
            </p>
          </>
        </div>
      </div>
    </DialogPopup>
  );
  const openBoardTask = (task: BoardTask) => {
    const thread = linkedBoardThread(task, threads);
    if (!thread) return;
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    useResumeCardStore.getState().open({
      key: `board:${task.folder}`,
      token: boardResumeToken(task),
      ref,
      title: task.title,
      reason: boardResumeReason(task),
      boardFolder: task.folder,
    });
    navigate(ref);
  };
  const threadRows = attention.map((thread) => {
    const key = inboxThreadKey(thread);
    const reason = reasons.get(key) ?? "有新结果";
    const label = attentionThreadLabel(thread, threads, reason);
    return {
      key,
      thread,
      boardTask: null as BoardTask | null,
      reason,
      label,
      timestamp: attentionTimestamp(thread),
      detail: label.detail,
    };
  });
  const boardRows = boardAttention.map((task) => ({
    key: `board:${task.folder}`,
    thread: linkedBoardThread(task, threads),
    boardTask: task,
    reason: boardResumeReason(task),
    label: { title: task.title },
    timestamp: task.state_since ?? "",
    detail: task.judge?.trim() || task.blocked?.trim() || task.next?.trim() || null,
  }));
  const allRows = [...threadRows, ...boardRows];
  const page = attentionPage(allRows, showAllAttention);
  const rows = page.rows.map((row, index) => ({ ...row, index }));
  const allKeys = new Set(allRows.map((row) => row.key));
  const exiting = useInboxExitRows(rows, allKeys);
  const displayedRows = [...rows];
  for (const row of exiting) displayedRows.splice(row.index, 0, row);
  return (
    <>
      <ActiveWorkOverview
        threads={threads}
        projects={projects}
        activeKey={activeKey}
        navigate={navigate}
        incomplete={incomplete}
      />
      <SidebarMenu>
        {/* Nothing counted and nothing listed: the row stays out of the way. */}
        {exiting.length > 0 ||
        shouldShowInboxRow(requestCount, attention.length + boardAttention.length) ? (
          <SidebarMenuItem>
            <div
              className="group/inbox-cap flex items-center gap-1.5 px-2 pt-2 pb-1 text-2xs tracking-wider text-sidebar-muted-foreground"
              data-sidebar-cap=""
            >
              <span>{uiText("Needs my attention")}</span>
              {nextShortcut && attention.length > 0 ? (
                <span className="tracking-normal opacity-0 transition-opacity group-hover/inbox-cap:opacity-70 motion-reduce:transition-none">
                  {uiText("Next item ")}
                  {nextShortcut}
                </span>
              ) : null}
              <span
                ref={badgeRef}
                aria-label={uiText("{requestCount} need answers", { requestCount })}
                className={`ml-auto min-w-5 rounded-full px-1.5 text-center font-semibold tracking-normal tabular-nums ${requestCount ? "bg-warning text-background" : ""}`}
              >
                {requestCount}
              </span>
            </div>
            {displayedRows.length > 0 ? (
              <ul
                aria-label={uiText("Conversations that need my attention")}
                className="space-y-px"
              >
                {displayedRows.map(
                  ({ key, thread, boardTask, reason, label, detail, timestamp }) => {
                    const failed = reason === "运行失败";
                    // oxlint-disable-next-line t3code/no-hardcoded-ui-han -- inbox reason key shared with inboxReason(), not display copy
                    const isResult = reason === "有新结果";
                    const leaving = !allKeys.has(key);
                    return (
                      <li
                        key={key}
                        inert={leaving}
                        aria-hidden={leaving || undefined}
                        className={cn(
                          "group/inbox-row relative",
                          leaving && "workbench-inbox-exit",
                        )}
                      >
                        <button
                          type="button"
                          data-inbox-thread={thread?.id}
                          data-inbox-task={boardTask?.folder}
                          onClick={() => {
                            if (boardTask) openBoardTask(boardTask);
                            else if (thread) openThread(thread);
                          }}
                          aria-current={activeKey === key ? "page" : undefined}
                          className="relative block w-full min-w-0 rounded-lg py-1.5 pr-2 pl-5.5 text-left outline-none hover:bg-sidebar-row-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:bg-sidebar-row-active"
                        >
                          {thread && !boardTask ? null : (
                            <span
                              aria-hidden
                              className={`absolute top-3.25 left-2.25 size-1.5 rounded-full ${failed ? "bg-destructive" : "bg-warning"}`}
                            />
                          )}
                          <span
                            className={cn(
                              "flex min-w-0 items-baseline gap-2",
                              // V14: the hover actions take this space instead of covering the title.
                              thread && !boardTask && "group-hover/inbox-row:pe-18",
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground">
                              {label.title}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 text-2xs tabular-nums text-sidebar-muted-foreground transition-opacity",
                                thread && !boardTask && "group-hover/inbox-row:hidden",
                              )}
                            >
                              {sidebarRelativeTime(timestamp)}
                            </span>
                          </span>
                          {thread ? (
                            <InboxProgress
                              thread={thread}
                              board={boardTask}
                              reason={reason}
                              detail={detail}
                            />
                          ) : null}
                        </button>
                        {thread && !boardTask && !leaving ? (
                          <InboxStatusDot
                            status={failed ? "failed" : isResult ? "result" : "needs-you"}
                            threadRef={scopeThreadRef(thread.environmentId, thread.id)}
                            onMarkDone={
                              isResult || failed ? () => completeThread(thread, failed) : undefined
                            }
                          />
                        ) : null}
                        {thread && !boardTask && !leaving ? (
                          <InboxQuickActions
                            mode={isResult || failed ? "finished" : "needs-you"}
                            threadRef={scopeThreadRef(thread.environmentId, thread.id)}
                            title={label.title}
                            doneLabel={failed ? uiText("Acknowledged") : uiText("Mark done")}
                            onDone={
                              isResult || failed ? () => completeThread(thread, failed) : undefined
                            }
                            onOpen={() => openThread(thread)}
                          />
                        ) : null}
                      </li>
                    );
                  },
                )}
                {allRows.length > page.rows.length || showAllAttention ? (
                  <li>
                    <button
                      type="button"
                      aria-expanded={showAllAttention}
                      onClick={() => setShowAllAttention(!showAllAttention)}
                      className="w-full rounded-lg py-1 pr-2 pl-5.5 text-left text-xs text-sidebar-muted-foreground outline-none hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      {showAllAttention
                        ? uiText("Collapse recommendation")
                        : uiText("{hidden} more", { hidden: page.hidden })}
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {storageError ? (
              <p role="alert" className="px-2 py-1 text-xs text-destructive">
                {uiText("Couldn’t save locally. Check browser storage and try again.")}
              </p>
            ) : null}
          </SidebarMenuItem>
        ) : null}
        {doneToday.length > 0 ? (
          <SidebarMenuItem data-inbox-done-today="">
            <button
              type="button"
              aria-expanded={showDoneToday}
              onClick={() => setShowDoneToday(!showDoneToday)}
              className="flex w-full items-center gap-1.5 rounded-md px-2 pt-2 pb-1 text-left text-2xs tracking-wider text-sidebar-muted-foreground outline-none hover:text-sidebar-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span>{uiText("Done today")}</span>
              <span className="ml-auto inline-flex items-center gap-0.5 tracking-normal tabular-nums">
                {doneToday.length}
                {showDoneToday ? (
                  <ChevronDownIcon aria-hidden className="size-3" />
                ) : (
                  <ChevronRightIcon aria-hidden className="size-3" />
                )}
              </span>
            </button>
            {showDoneToday ? (
              <ul aria-label={uiText("Done today")} className="space-y-px">
                {doneToday.map((thread) => {
                  const ref = scopeThreadRef(thread.environmentId, thread.id);
                  return (
                    <li key={inboxThreadKey(thread)} className="group/inbox-row relative">
                      <button
                        type="button"
                        data-inbox-done-thread={thread.id}
                        onClick={() => navigate(ref)}
                        aria-current={activeKey === inboxThreadKey(thread) ? "page" : undefined}
                        className="relative block w-full min-w-0 rounded-lg py-1.5 pr-2 pl-5.5 text-left opacity-65 outline-none hover:bg-sidebar-row-hover hover:opacity-100 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:bg-sidebar-row-active aria-[current=page]:opacity-100"
                      >
                        <span className="flex min-w-0 items-baseline gap-2 group-hover/inbox-row:pe-18">
                          <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground">
                            {thread.title || uiText("Untitled thread")}
                          </span>
                          <span className="shrink-0 text-2xs tabular-nums text-sidebar-muted-foreground group-hover/inbox-row:hidden">
                            {sidebarRelativeTime(thread.settledAt ?? thread.updatedAt)}
                          </span>
                        </span>
                      </button>
                      <InboxStatusDot
                        status="done"
                        threadRef={ref}
                        onMarkTodo={() => reopenThread(thread)}
                      />
                      <InboxQuickActions
                        mode="done"
                        threadRef={ref}
                        title={thread.title}
                        onRestore={() => reopenThread(thread)}
                        onOpen={() => navigate(ref)}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </SidebarMenuItem>
        ) : null}
        <SidebarMenuItem>
          <Dialog open={view === "resume"} onOpenChange={(open) => setView(open ? "resume" : null)}>
            {panel}
          </Dialog>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
