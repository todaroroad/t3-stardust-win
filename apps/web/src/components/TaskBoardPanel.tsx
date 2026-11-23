import { uiText } from "../i18n";
import {
  resolveSnoozePresets as defaultPresets,
  pickSnoozePreset as pickDefaultPreset,
} from "@t3tools/client-runtime/state/thread-settled";
import { useNowMinute } from "../hooks/useNowMinute";
import { Fragment, useEffect, useRef, useState } from "react";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  Eye,
  Hand,
  LockKeyhole,
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  Video,
  MessageSquare,
  ExternalLink,
  Unplug,
  Copy,
} from "lucide-react";
import {
  useTaskBoard,
  setTaskBoardCwd,
  mutateTaskBoard,
  refreshTaskBoard,
  TASK_BOARD_START_COMMAND,
  requestTaskBoardCurrent,
} from "../taskBoard";
import {
  boardStateLabel,
  boardTaskMatchesFilter,
  matchBoardTask,
  type BoardTask,
  boardCurrentStep,
  boardTaskKind,
  boardTaskHeading,
  boardWaitDays,
  boardTaskGroup,
  sortBoardTasks,
  boardProgress,
  boardLevelRank,
  boardApprovalsToday,
  boardEvidenceTarget,
} from "../taskBoard.logic";
import { useRightPanelStore } from "../rightPanelStore";
import { useThreadShells, useProjects } from "../state/entities";
import { Button } from "./ui/button";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "./ui/menu";
import { resolveSnoozePresets, pickSnoozePreset, type SnoozePreset } from "./Sidebar.snooze";
import { requestCustomSnooze } from "./CustomSnoozeDialog";
import { shellEnvironment } from "../state/shell";
import { useAtomCommand } from "../state/use-atom-command";
import { toastManager } from "./ui/toast";
import { TaskInbox } from "./TaskInbox";

export function TaskBoardSnooze({
  task,
  environmentId,
}: {
  task: BoardTask;
  environmentId?: EnvironmentId | undefined;
}) {
  const [presets, setPresets] = useState<ReadonlyArray<SnoozePreset>>([]);
  const save = async (until: string) => {
    try {
      await mutateTaskBoard("snooze", { folder: task.folder, until });
    } catch (error) {
      toastManager.add({ type: "error", title: String(error) });
    }
  };
  return (
    <Menu
      onOpenChange={(open) => {
        if (open)
          setPresets(
            environmentId
              ? resolveSnoozePresets(new Date(), "locale", environmentId)
              : defaultPresets(new Date()),
          );
      }}
    >
      <MenuTrigger render={<Button size="xs" variant="outline" />}>
        {uiText("Remind me later")}
      </MenuTrigger>
      <MenuPopup>
        {presets.map((preset) => (
          <MenuItem
            key={preset.id}
            onClick={() => {
              const picked = environmentId
                ? pickSnoozePreset(presets, preset.id, "locale", environmentId)
                : pickDefaultPreset({ shown: presets, id: preset.id, now: new Date() });
              if (picked) void save(picked.snoozedUntil);
            }}
          >
            {preset.label} · {preset.whenLabel}
          </MenuItem>
        ))}
        <MenuItem
          onClick={async () => {
            const choice = await requestCustomSnooze();
            if (choice) await save(choice.snoozedUntil);
          }}
        >
          {uiText("Custom…")}
        </MenuItem>
        {task.snoozed ? (
          <MenuItem onClick={() => void save("")}>{uiText("Cancel reminder")}</MenuItem>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}
export function TaskBoardBadge() {
  // Same rule as the sidebar entry and the inbox: requests that need the user, not snoozed.
  const count = useTaskBoard((s) =>
    s.error
      ? 0
      : (s.data?.tasks.filter(
          (task) => !task.snoozed && (task.state === "user" || task.state === "blocked"),
        ).length ?? 0),
  );
  return count ? (
    <span className="rounded-full bg-warning/15 px-1.5 text-3xs tabular-nums text-warning-foreground">
      {count}
    </span>
  ) : null;
}
export function TaskBoardDot({ cwd, threadId }: { cwd: string | null; threadId: string }) {
  const state = useTaskBoard((s) =>
    s.error ? null : matchBoardTask(s.data?.tasks ?? [], cwd, threadId)?.state,
  );
  if (!state || state === "done") return null;
  return (
    <span
      aria-label={uiText("Project tasks: {count}", { count: boardStateLabel[state] })}
      className={`size-1.5 shrink-0 rounded-full ${state === "user" ? "bg-warning" : state === "blocked" ? "bg-destructive" : "bg-primary"}`}
    />
  );
}

function TaskProgress({
  task,
  mini = false,
  caption = true,
}: {
  task: BoardTask;
  mini?: boolean;
  caption?: boolean;
}) {
  const { currentIndex, nextGateDistance } = boardProgress(task);
  const step = boardCurrentStep(task);
  return (
    <div className={mini ? "w-24 shrink-0" : "min-w-0"}>
      <div
        role="img"
        aria-label={uiText("{done}/{total} steps passed{current}", {
          done: task.done_count,
          total: task.total,
          current: step ? uiText(", current: {name}", { name: step.name }) : "",
        })}
        className={`flex items-center ${mini ? "h-4" : "h-5"}`}
      >
        {task.steps.map((s, index) => (
          <Fragment key={s.id}>
            {index ? (
              <span
                aria-hidden
                className={`h-0.5 min-w-0 flex-1 ${task.steps[index - 1]?.done ? "bg-success" : "bg-border"}`}
              />
            ) : null}
            {index === currentIndex ? (
              <span
                data-task-station={s.id}
                data-current-station={task.state}
                aria-label={uiText("{label}: {value}", {
                  label: s.name,
                  value: boardStateLabel[task.state],
                })}
                className={`grid shrink-0 place-items-center rounded-full font-bold text-primary-foreground ${mini ? "size-3.5 text-4xs" : "size-5 text-3xs ring-3"} ${task.state === "blocked" ? "bg-destructive ring-destructive/10" : task.state === "user" ? "bg-warning ring-warning/10" : "bg-primary ring-primary/10"}`}
              >
                {task.state === "blocked" ? (
                  <LockKeyhole className={mini ? "size-2" : "size-3"} />
                ) : task.state === "user" ? (
                  uiText("You")
                ) : (
                  "AI"
                )}
              </span>
            ) : (
              <span
                data-task-station={s.id}
                data-task-gate={s.required === "user" || undefined}
                aria-label={`${s.name}${s.required === "user" ? uiText(": your approval") : ""}${s.done ? uiText(", passed") : ""}`}
                className={`shrink-0 border-2 ${mini ? "size-1.5" : "size-2"} ${s.done ? "border-success bg-success" : "border-border bg-background"} ${s.required === "user" ? "rotate-45 rounded-xs" : "rounded-full"}`}
              />
            )}
          </Fragment>
        ))}
      </div>
      {!mini && caption ? (
        <div className="mt-1 flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5 text-3xs text-muted-foreground">
          <span className="min-w-0 break-words">
            {step ? uiText("Current: {name}", { name: step.name }) : uiText("All steps passed")}
          </span>
          <span>
            {task.done_count}/{task.total}
            {nextGateDistance !== null
              ? uiText(" · Next review in {nextGateDistance} steps", { nextGateDistance })
              : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
function TaskSteps({ task }: { task: BoardTask }) {
  const current = boardCurrentStep(task);
  const levels = ["self", "review", "user"] as const;
  const labels = [uiText("Self-check"), uiText("Review"), uiText("Your confirmation")];
  return (
    <ol aria-label={uiText("{title}all steps", { title: task.title })} className="space-y-1">
      {task.steps.map((step) => (
        <li
          key={step.id}
          data-current-step={step.id === current?.id || undefined}
          className={`flex min-h-6 items-center gap-2.5 text-xs ${step.id === current?.id ? "font-semibold text-foreground" : "text-muted-foreground"}`}
        >
          <span
            aria-hidden
            className={`size-2 shrink-0 border-2 ${step.done ? "border-success bg-success" : step.id === current?.id ? (task.state === "blocked" ? "border-destructive bg-destructive" : task.state === "agent" ? "border-primary bg-primary" : "border-warning bg-warning") : "border-border"} ${step.required === "user" ? "rotate-45 rounded-xs" : "rounded-full"}`}
          />
          <span className="min-w-0 flex-1 break-words">
            {step.name}
            {step.id === current?.id
              ? task.state === "user"
                ? step.pending_review
                  ? uiText(" · Needs your decision")
                  : uiText(" · Your action needed")
                : task.state === "blocked"
                  ? uiText(" · Blocked")
                  : uiText(" · Agent working")
              : ""}
          </span>
          {step.done || step.id === current?.id || boardLevelRank(step) > 0 ? (
            <span
              className="flex shrink-0 gap-0.5"
              aria-label={uiText("Verification level: {level}", {
                level: labels[boardLevelRank(step) - 1] ?? uiText("Incomplete"),
              })}
            >
              {levels.map((level, index) => (
                <span
                  key={level}
                  aria-label={uiText("{label}: {value}", {
                    label: labels[index],
                    value:
                      boardLevelRank(step) > index
                        ? uiText("Passed")
                        : step.required === level
                          ? uiText("Needs verification")
                          : uiText("Did not pass"),
                  })}
                  className={`h-1 w-2.5 rounded-xs ${boardLevelRank(step) > index ? "bg-success" : step.required === level ? "border border-dashed border-warning" : "bg-border"}`}
                />
              ))}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
function TaskPrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-6.5 items-center justify-center gap-1 rounded-lg border border-foreground bg-foreground px-2.5 text-xs font-medium text-background outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
export function TaskBoardPanel({
  cwd,
  threadRef,
}: {
  cwd: string | null;
  threadRef: ScopedThreadRef;
}) {
  const { data, error, loading, entry, reveal } = useTaskBoard();
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}Z`);
  const activeHint = entry?.threadKey === scopedThreadKey(threadRef) ? entry : null;
  const [selection, setSelection] = useState<{
    view: "waiting" | "current" | "all";
    revision: number;
  }>({ view: "waiting", revision: 0 });
  const [highlight, setHighlight] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [completedOpen, setCompletedOpen] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const openInEditor = useAtomCommand(shellEnvironment.openInEditor, { reportFailure: false });
  const threads = useThreadShells();
  const projects = useProjects();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- The service resolves the workspace and symlinks for its current-project response.
  useEffect(() => {
    void setTaskBoardCwd(cwd);
  }, [cwd]);
  const current = matchBoardTask(data?.tasks ?? [], cwd, threadRef.threadId);
  const requestedView =
    activeHint && activeHint.revision !== selection.revision ? "current" : selection.view;
  const view = requestedView;
  const choose = (next: typeof selection.view) => {
    setSelection({ view: next, revision: activeHint?.revision ?? 0 });
    setMutationError(null);
  };
  const scrollKey =
    view === "current" ? `${current?.folder}:${current?.current_id}:${activeHint?.revision}` : null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Bring the requested current step into the panel viewport after thread navigation commits.
  useEffect(() => {
    if (scrollKey)
      bodyRef.current
        ?.querySelector<HTMLElement>("[data-current-step=true]")
        ?.scrollIntoView({ block: "nearest" });
  }, [scrollKey]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- External attention entries reveal a task without changing the current conversation.
  useEffect(() => {
    if (!reveal) return;
    // oxlint-disable-next-line react/set-state-in-effect -- Apply an external task reveal request after this panel mounts.
    setSelection({ view: "waiting", revision: activeHint?.revision ?? 0 });
    setHighlight(reveal.folder);
    const timer = setTimeout(() => setHighlight(null), 1000);
    return () => clearTimeout(timer);
  }, [reveal, activeHint?.revision]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Scroll the committed task card after an external reveal request.
  useEffect(() => {
    if (highlight)
      bodyRef.current
        ?.querySelector<HTMLElement>(`[data-task-folder="${CSS.escape(highlight)}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [highlight]);
  const tasks = sortBoardTasks(data?.tasks ?? []);
  const attention = tasks.filter(
    (task) => !task.snoozed && (task.state === "user" || task.state === "blocked"),
  );
  const firstAttention = ["judge", "do", "blocked"].flatMap((group) =>
    attention.filter((task) => boardTaskGroup(task) === group),
  )[0]?.folder;
  const approvals = boardApprovalsToday(tasks, new Date(now));
  const projectsByKey = new Map(projects.map((p) => [`${p.environmentId}:${p.id}`, p] as const));
  const linkedThreadsByFolder = new Map<string, typeof threads>();
  for (const task of tasks) {
    const matched = threads
      .filter(
        (thread) =>
          task.sessions.includes(thread.id) ||
          matchBoardTask(
            [task],
            thread.worktreePath ??
              projectsByKey.get(`${thread.environmentId}:${thread.projectId}`)?.workspaceRoot,
          ) !== null,
      )
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    linkedThreadsByFolder.set(task.folder, matched);
  }
  const linkedThreads = (task: BoardTask) => linkedThreadsByFolder.get(task.folder) ?? [];
  const openThread = (ref: ScopedThreadRef) => {
    requestTaskBoardCurrent(ref);
    useRightPanelStore.getState().open(ref, "tasks");
    void navigate({ to: "/$environmentId/$threadId", params: ref });
  };
  const openProject = async (task: BoardTask) => {
    toastManager.add({
      type: "info",
      title: uiText("This project has no linked conversation."),
      description: uiText("Opening the project folder."),
    });
    const result = await openInEditor({
      environmentId: threadRef.environmentId,
      input: { cwd: task.folder, editor: "file-manager" },
    });
    if (result._tag === "Failure")
      setMutationError(uiText("Couldn’t open project folder: {folder}", { folder: task.folder }));
  };
  const openTask = (task: BoardTask) => {
    const thread = linkedThreads(task)[0];
    if (thread) openThread(scopeThreadRef(thread.environmentId, thread.id));
    else void openProject(task);
  };
  const openEvidence = (task: BoardTask, evidence: string) => {
    const target = boardEvidenceTarget(task.folder, evidence);
    const linked = linkedThreads(task)[0];
    const ref = linked
      ? scopeThreadRef(linked.environmentId, linked.id)
      : current?.folder === task.folder
        ? threadRef
        : null;
    if (!target || target.kind !== "file" || !ref) {
      setMutationError(uiText("Open a conversation for this project to preview the evidence."));
      return;
    }
    useRightPanelStore.getState().openFile(ref, target.value);
    void navigate({ to: "/$environmentId/$threadId", params: ref });
  };
  const save = async (task: BoardTask, decision: "approve" | "reject" | "toggle") => {
    const step = boardCurrentStep(task);
    if (!step || pending) return;
    if (decision === "reject" && !reason.trim()) {
      setMutationError(uiText("Add a short reason for requesting changes."));
      return;
    }
    setPending(task.folder);
    setMutationError(null);
    try {
      if (decision === "toggle")
        await mutateTaskBoard("toggle", { folder: task.folder, step: step.id });
      else
        await mutateTaskBoard("review", {
          folder: task.folder,
          step: step.id,
          decision,
          ...(decision === "reject" ? { reason: reason.trim() } : {}),
        });
      setRejecting(null);
      setReason("");
    } catch (error) {
      setMutationError(String(error));
    }
    setPending(null);
  };
  const linkSession = async (
    task: BoardTask,
    session: string,
    title: string,
    action: "link" | "unlink" = "link",
  ) => {
    try {
      await mutateTaskBoard("link", {
        folder: task.folder,
        session,
        title,
        action,
        source: "manual",
      });
    } catch (error) {
      setMutationError(String(error));
    }
  };
  const links = (task: BoardTask, label = uiText("Open thread")) => {
    const linked = linkedThreads(task);
    if (!linked.length)
      return (
        <div className="flex flex-wrap gap-1.5">
          <Menu>
            <MenuTrigger render={<Button size="xs" variant="outline" />}>
              {uiText("Link conversation")}
            </MenuTrigger>
            <MenuPopup>
              {[...threads]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 10)
                .map((thread) => (
                  <MenuItem
                    key={`${thread.environmentId}:${thread.id}`}
                    onClick={() => void linkSession(task, thread.id, thread.title)}
                  >
                    {thread.title}
                  </MenuItem>
                ))}
            </MenuPopup>
          </Menu>
          <Button size="xs" variant="outline" onClick={() => void openProject(task)}>
            {uiText("Open project folder")}
          </Button>
        </div>
      );
    if (linked.length === 1)
      return (
        <Button
          size="xs"
          variant="outline"
          title={linked[0]!.title}
          onClick={() => openThread(scopeThreadRef(linked[0]!.environmentId, linked[0]!.id))}
        >
          <MessageSquare />
          {label}
        </Button>
      );
    return (
      <Menu>
        <MenuTrigger render={<Button size="xs" variant="outline" />}>
          <MessageSquare />
          {label} {linked.length}
        </MenuTrigger>
        <MenuPopup>
          {linked.slice(0, 5).map((thread) => (
            <Fragment key={`${thread.environmentId}:${thread.id}`}>
              <MenuItem onClick={() => openThread(scopeThreadRef(thread.environmentId, thread.id))}>
                {thread.title} · {thread.updatedAt.slice(0, 10)}
              </MenuItem>
              <MenuItem onClick={() => void linkSession(task, thread.id, thread.title, "unlink")}>
                {uiText("Unlink")}
              </MenuItem>
            </Fragment>
          ))}
        </MenuPopup>
      </Menu>
    );
  };
  const evidenceTags = (task: BoardTask) => (
    <div className="pointer-events-auto mt-1 flex flex-wrap gap-1">
      {(boardCurrentStep(task)?.evidence ?? []).map((evidence) => {
        const target = boardEvidenceTarget(task.folder, evidence);
        const label = evidence.split("/").at(-1) || evidence;
        const Icon = /\.(png|jpe?g|webp|gif|avif)$/i.test(evidence)
          ? Image
          : /\.(mp4|mov|webm)$/i.test(evidence)
            ? Video
            : FileText;
        const classes =
          "inline-flex max-w-full items-center gap-1 rounded-md bg-accent px-1.5 py-1 text-3xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";
        return target?.kind === "url" ? (
          <a
            key={evidence}
            href={target.value}
            target="_blank"
            rel="noreferrer"
            className={classes}
          >
            <Icon className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </a>
        ) : (
          <button
            key={evidence}
            type="button"
            disabled={!target}
            className={classes}
            onClick={() => openEvidence(task, evidence)}
          >
            <Icon className="size-3 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
  const card = (task: BoardTask, forceCurrent = false, first = false) => {
    const kind = boardTaskKind(task),
      step = boardCurrentStep(task),
      waitingDays = boardWaitDays(task, now);
    const isOpen = expanded[task.folder] ?? (view === "waiting" && first);
    const kindLabel =
      task.state === "done"
        ? uiText("Completed")
        : task.state === "agent"
          ? uiText("Underway")
          : kind === "review"
            ? uiText("Review outcome")
            : kind === "decide"
              ? uiText("Decide")
              : kind === "unlock" || kind === "blocked"
                ? uiText("Unlock")
                : (step?.name.match(/口播|录音|拍摄|上传|补充|填写/)?.[0] ?? uiText("Take action"));
    const actionable = task.state === "user" || task.state === "blocked";
    return (
      <article
        key={task.folder}
        aria-label={task.title}
        data-task-folder={task.folder}
        data-highlighted={highlight === task.folder || undefined}
        style={{ borderRadius: "calc(var(--radius) + 2px)" }}
        className={`relative mx-2 mb-1.5 border data-highlighted:ring-2 data-highlighted:ring-warning bg-background px-3 py-2.5 ${isOpen || forceCurrent ? "border-warning/40" : "border-border hover:border-foreground/20"}`}
      >
        {!forceCurrent ? (
          <button
            type="button"
            aria-label={uiText("{action} steps for {title}", {
              action: isOpen ? uiText("Collapse recommendation") : uiText("Expand"),
              title: task.title,
            })}
            aria-expanded={isOpen}
            onClick={() => setExpanded((previous) => ({ ...previous, [task.folder]: !isOpen }))}
            className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
        ) : null}
        <div className="pointer-events-none relative">
          <div className="flex min-w-0 items-center gap-1.5 text-3xs text-muted-foreground">
            <span
              className={`shrink-0 rounded-sm px-1.5 py-0.5 font-semibold ${task.state === "blocked" ? "bg-destructive/10 text-destructive" : task.state === "agent" ? "bg-primary/10 text-primary" : task.state === "done" ? "bg-success/10 text-success-foreground" : "bg-warning/10 text-warning-foreground"}`}
            >
              {kindLabel}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {forceCurrent
                ? task.state === "user"
                  ? uiText("Your turn")
                  : boardStateLabel[task.state]
                : task.title}
            </span>
            <span className="shrink-0">
              {task.snoozed
                ? uiText("Remind me later")
                : waitingDays === null
                  ? ""
                  : waitingDays === 0
                    ? uiText("Today")
                    : waitingDays === 1
                      ? uiText("Waiting {waitingDays} day", { waitingDays })
                      : uiText("Waiting {waitingDays} days", { waitingDays })}
            </span>
          </div>
          <h3 className="mt-1.5 break-words text-sm leading-snug font-semibold">
            {task.state === "agent"
              ? task.next || step?.name || uiText("Agent making progress")
              : boardTaskHeading(task)}
          </h3>
          {evidenceTags(task)}
          {task.missing.length ? (
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {uiText("Missing:")}
              {task.missing.join(" · ")}
            </p>
          ) : null}
          {!forceCurrent ? (
            <div className="mt-3">
              <TaskProgress task={task} />
            </div>
          ) : null}
          {!forceCurrent && isOpen ? (
            <div className="mt-2.5 border-t pt-1.5">
              <TaskSteps task={task} />
            </div>
          ) : null}
          <div className="pointer-events-auto mt-2.5 flex flex-wrap gap-1.5">
            {actionable && (kind === "unlock" || kind === "blocked") ? (
              <TaskPrimaryButton onClick={() => openTask(task)}>
                <ExternalLink className="size-3" />
                {uiText("Open task")}
              </TaskPrimaryButton>
            ) : actionable && kind === "review" ? (
              <>
                <TaskPrimaryButton
                  disabled={pending !== null || !step}
                  onClick={() => void save(task, "approve")}
                >
                  <Check className="size-3" />
                  {uiText("Pass review")}
                </TaskPrimaryButton>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={pending !== null || !step}
                  onClick={() => {
                    setRejecting(rejecting === task.folder ? null : task.folder);
                    setReason("");
                    setMutationError(null);
                  }}
                >
                  {uiText("Request changes…")}
                </Button>
              </>
            ) : actionable && kind === "decide" ? (
              <TaskPrimaryButton
                disabled={pending !== null || !step}
                onClick={() => void save(task, "approve")}
              >
                {uiText("I’ve decided")}
              </TaskPrimaryButton>
            ) : actionable ? (
              <>
                <TaskPrimaryButton
                  disabled={pending !== null || !step}
                  onClick={() => void save(task, "toggle")}
                >
                  {uiText("I’m done")}
                </TaskPrimaryButton>
                <TaskBoardSnooze task={task} environmentId={threadRef.environmentId} />
              </>
            ) : null}
            {links(task)}
            {task.snoozed && kind !== "do" ? (
              <TaskBoardSnooze task={task} environmentId={threadRef.environmentId} />
            ) : null}
          </div>
          {rejecting === task.folder ? (
            <form
              className="pointer-events-auto mt-2 flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                void save(task, "reject");
              }}
            >
              <input
                aria-label={uiText("Reason for changes")}
                placeholder={uiText("Describe what needs to change")}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              />
              <Button
                type="submit"
                size="xs"
                variant="outline"
                disabled={!reason.trim() || pending !== null}
              >
                {uiText("Confirm request for changes")}
              </Button>
            </form>
          ) : null}
        </div>
      </article>
    );
  };
  const allTasks = tasks.filter((task) => task.state !== "done");
  const complete = tasks.filter((task) => boardTaskMatchesFilter(task, "done_week", now));
  return (
    <section
      aria-label={uiText("Task board")}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
    >
      {error ? (
        <div role="status" className="px-6 py-10 text-center text-xs text-muted-foreground">
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-accent">
            <Unplug className="size-5" />
          </div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            {uiText("Task board service is offline")}
          </h2>
          <p>
            {uiText("Task data is temporarily unavailable. Other T3 features are still available.")}
          </p>
          <code className="my-3 block break-all rounded-md bg-accent px-2 py-1.5 text-left text-3xs">
            {TASK_BOARD_START_COMMAND}
          </code>
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              void navigator.clipboard
                .writeText(TASK_BOARD_START_COMMAND)
                .then(() => setCopied(true))
                .catch(() =>
                  setMutationError(uiText("Couldn’t copy. Copy the command above manually.")),
                )
            }
          >
            <Copy />
            {copied ? uiText("Copied") : uiText("Copy command")}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => void refreshTaskBoard()}>
            {uiText("Retry message")}
          </Button>
          {mutationError ? (
            <p role="alert" className="mt-2 text-destructive">
              {mutationError}
            </p>
          ) : null}
        </div>
      ) : loading || !data ? (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          {uiText("Loading tasks…")}
        </p>
      ) : (
        <>
          <header className="px-3.5 pt-3.5 pb-1">
            {view === "waiting" ? (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h2 className="text-xl font-semibold tracking-tight">
                  {uiText("Needs my attention")}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {uiText("Items that need your response now")}
                </span>
              </div>
            ) : null}
            <div
              role="group"
              aria-label={uiText("Task view")}
              className={`inline-flex max-w-full gap-0.5 rounded-lg bg-accent p-0.5 ${view === "waiting" ? "mt-2.5" : ""}`}
            >
              {(
                [
                  ["waiting", uiText("To do")],
                  ["current", uiText("This conversation")],
                  ["all", uiText("All projects ({count})", { count: allTasks.length })],
                ] as const
              ).map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={view === id}
                  aria-describedby={
                    id === "current" && !current ? "task-board-no-current" : undefined
                  }
                  onClick={() => choose(id)}
                  className={`min-w-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-40 ${view === id ? "bg-background text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!current && view === "current" ? (
              <p id="task-board-no-current" className="mt-1 text-3xs text-muted-foreground">
                {uiText("No tasks are linked to this conversation")}
              </p>
            ) : null}
          </header>
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-both pb-2">
            {mutationError ? (
              <p role="alert" className="break-words px-3.5 py-2 text-xs text-destructive">
                {mutationError}
              </p>
            ) : null}
            {view === "waiting" ? (
              <TaskInbox threadRef={threadRef} />
            ) : view === "current" && !current ? (
              <div className="space-y-2 p-3.5">
                <p>{uiText("No tasks are linked to this conversation")}</p>
                {attention.map((task) => (
                  <Button
                    key={task.folder}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void linkSession(
                        task,
                        threadRef.threadId,
                        threads.find((t) => t.id === threadRef.threadId)?.title ??
                          uiText("Current thread"),
                      )
                    }
                  >
                    {task.title}
                  </Button>
                ))}
              </div>
            ) : view === "current" && current ? (
              <>
                <div className="mb-2.5 border-b px-3.5 pt-3 pb-2.5">
                  <p className="break-all text-3xs text-muted-foreground">
                    {current.type_label ? `${current.type_label} · ` : ""}
                    {current.folder}
                  </p>
                  <h2 className="mt-1 text-base font-semibold">{current.title}</h2>
                  <div className="mt-3">
                    <TaskProgress task={current} />
                  </div>
                </div>
                {card(current, true)}
                <div className="px-3.5 pt-1 pb-3">
                  <TaskSteps task={current} />
                </div>
                <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => openEvidence(current, "HANDOFF.md")}
                  >
                    <FileText />
                    HANDOFF
                  </Button>
                  {links(current, uiText("Link conversation"))}
                </div>
              </>
            ) : (
              <>
                {["user", "blocked", "agent"].map((group) => {
                  const list = allTasks.filter((task) =>
                    group === "user" ? task.state === "user" : boardTaskGroup(task) === group,
                  );
                  const Icon =
                    group === "judge" || group === "user"
                      ? Eye
                      : group === "do"
                        ? Hand
                        : group === "blocked"
                          ? LockKeyhole
                          : Bot;
                  const label =
                    group === "judge"
                      ? uiText("Your decision")
                      : group === "do"
                        ? uiText("Your action")
                        : group === "blocked"
                          ? uiText("Blocked")
                          : group === "user"
                            ? uiText("Waiting for you")
                            : uiText("Agent working");
                  return list.length ? (
                    <section key={group}>
                      <h3 className="flex items-center gap-1.5 px-3.5 pt-3 pb-1.5 text-3xs font-semibold text-muted-foreground">
                        <Icon className="size-3" />
                        {label} · {list.length}
                      </h3>
                      {list.map((task) => card(task, false, task.folder === firstAttention))}
                    </section>
                  ) : null;
                })}
                {view === "all" ? (
                  <section>
                    <button
                      type="button"
                      aria-expanded={completedOpen}
                      className="flex w-full items-center gap-1.5 px-3.5 pt-3 pb-1.5 text-3xs text-muted-foreground"
                      onClick={() => setCompletedOpen(!completedOpen)}
                    >
                      {completedOpen ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                      {uiText("Completed this week · ")}
                      {complete.length}
                    </button>
                    {completedOpen ? complete.map((task) => card(task)) : null}
                  </section>
                ) : null}
              </>
            )}
          </div>
          <footer className="flex flex-wrap justify-between gap-1 border-t px-3.5 py-2 text-3xs text-muted-foreground">
            {approvals !== null ? (
              <span>
                {uiText("You approved ")}
                {approvals} {uiText(" steps today")}
              </span>
            ) : (
              <span />
            )}
            <span>{uiText("Notifications paused 23:00–9:00")}</span>
          </footer>
        </>
      )}
    </section>
  );
}
