import { inboxLabel } from "~/i18n/inboxLabel";
import { useUiText } from "~/i18n/useUiText";
import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import { useEffect, useEffectEvent, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedProjectRef, ScopedThreadRef } from "@t3tools/contracts";
import { CommandIcon, BotIcon } from "lucide-react";
import { useVisibleThreadShells, useQuietThreadProjection } from "~/state/entities";
import { useEnvironmentProviders } from "~/state/environments";
import { environmentThreadDetails } from "~/state/threads";
import { useTaskBoard } from "~/taskBoard";
import { taskProgressSnapshot } from "~/taskProgress";
import { useComposerDraftStore, type ComposerThreadTarget } from "~/composerDraftStore";
import {
  boardResumeToken,
  threadResumeToken,
  resumeCardDetails,
  resumeRequestHidden,
} from "~/resumeCard";
import { useResumeCardStore } from "~/resumeCardStore";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { BoardTask } from "~/taskBoard.logic";
import { buildThreadRouteParams } from "~/threadRoutes";

import {
  recentProjectThreads,
  skillFrequency,
  startThreadStatus,
  startThreadBoard,
  startRelativeTime,
} from "./stardustStartModel";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
const recentMessages = Atom.family((key: string) =>
  Atom.make((get) => {
    const refs = JSON.parse(key) as ScopedThreadRef[];
    return refs.flatMap(
      (ref) =>
        get(environmentThreadDetails.threadAtom(ref))
          ?.projection.messages.filter((m) => m.role === "user")
          .map((m) => ({ role: m.role, text: m.text })) ?? [],
    );
  }),
);
function ResumeTile({
  thread,
  index,
  status,
  board,
  now,
  onOpen,
}: {
  readonly thread: EnvironmentThreadShell;
  readonly index: number;
  readonly status: string;
  readonly board: BoardTask | undefined;
  readonly now: number;
  readonly onOpen: () => void;
}) {
  const uiText = useUiText();
  const detail = useQuietThreadProjection(scopeThreadRef(thread.environmentId, thread.id));
  const progress = taskProgressSnapshot(detail?.projection ?? null, thread);
  const model = resumeCardDetails(
    {
      key: "",
      token: "",
      ref: scopeThreadRef(thread.environmentId, thread.id),
      title: thread.title,
      reason: status,
    },
    progress,
    undefined,
    board,
  );
  const total = model.steps.length;
  const done = model.steps.filter((step) => step.status === "completed").length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="stardust-resume-tile min-w-0 rounded-xl bg-card p-3 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <strong className="block truncate text-xs font-semibold">
        {board?.title ?? thread.title}
      </strong>
      <small className="mt-1 block text-2xs text-muted-foreground">
        {startRelativeTime(thread.updatedAt, now, uiText)}
        {total > 0
          ? ` · ${uiText("Step {done}/{total}", { done: Math.min(total, done + 1), total })}`
          : ""}
      </small>
      <span className="mt-2 flex items-center gap-2">
        <span
          className={
            status === "运行失败"
              ? "rounded-full bg-destructive/10 px-2 py-0.5 text-3xs font-medium text-destructive"
              : "rounded-full bg-warning/10 px-2 py-0.5 text-3xs font-medium text-warning"
          }
        >
          {inboxLabel(status)}
        </span>
        {total > 0 ? (
          <span
            className="flex h-[3px] flex-1 gap-0.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label={uiText("Task progress")}
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            {model.steps.map((step, index) => (
              <span
                key={step.id}
                className={`h-full flex-1 ${step.status === "completed" ? "bg-sidebar-foreground" : index === model.currentIndex ? "bg-warning" : "bg-sidebar-border"}`}
              />
            ))}
          </span>
        ) : null}
        <kbd className="ml-auto flex items-center text-3xs text-muted-foreground">
          <CommandIcon className="size-2.5" strokeWidth={1.6} />
          {index + 1}
        </kbd>
      </span>
    </button>
  );
}
export function StardustStart({
  project,
  target,
}: {
  readonly project: ScopedProjectRef | null;
  readonly target: ComposerThreadTarget;
}) {
  const uiText = useUiText();
  const threads = useVisibleThreadShells();
  const boardData = useTaskBoard((s) => (s.error ? undefined : s.data?.tasks));
  const hidden = useResumeCardStore((s) => s.hidden);
  const hiddenUntil = useResumeCardStore((s) => s.hiddenUntil);
  const requests = useTaskBoard((s) => s.threadRequests);
  const providers = useEnvironmentProviders();
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const boards = (boardData ?? []).filter(
    (board) =>
      !resumeRequestHidden(
        `board:${board.folder}`,
        boardResumeToken(board),
        hidden,
        hiddenUntil,
        now,
      ),
  );
  const projectThreads = recentProjectThreads(threads, project);
  const recent = projectThreads.slice(0, 12);
  const candidates = projectThreads
    .flatMap((thread) => {
      const status = startThreadStatus(thread, boards, requests, threads);
      const hasPublishedThreadRequest = requests.some(
        (request) =>
          request.ref.environmentId === thread.environmentId && request.ref.threadId === thread.id,
      );
      const board = hasPublishedThreadRequest
        ? undefined
        : startThreadBoard(thread, boards, threads);
      return status ? [{ thread, status, board }] : [];
    })
    .slice(0, 3);
  const skills = (project ? (providers.get(project.environmentId) ?? []) : [])
    .flatMap((p) => p.skills)
    .filter((s) => s.enabled && s.userInvocable !== false);
  const messages = useAtomValue(
    recentMessages(JSON.stringify(recent.map((t) => scopeThreadRef(t.environmentId, t.id)))),
  );
  const frequent = skillFrequency(messages, new Set(skills.map((s) => s.name)));
  const open = (thread: EnvironmentThreadShell) => {
    const candidate = candidates.find((item) => item.thread.id === thread.id);
    if (candidate && candidate.status !== uiText("In progress")) {
      const ref = scopeThreadRef(thread.environmentId, thread.id);
      useResumeCardStore.getState().open({
        key: candidate.board ? `board:${candidate.board.folder}` : scopedThreadKey(ref),
        token: candidate.board
          ? boardResumeToken(candidate.board)
          : threadResumeToken(thread, candidate.status),
        ref,
        title: candidate.board?.title ?? thread.title,
        reason: candidate.status,
        ...(candidate.board ? { boardFolder: candidate.board.folder } : {}),
      });
    }
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(thread.environmentId, thread.id)),
    });
  };
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.repeat ||
      !event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    )
      return;
    const candidate = candidates[Number(event.key) - 1];
    if (!candidate) return;
    event.preventDefault();
    event.stopPropagation();
    open(candidate.thread);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- binds the three continuation shortcuts only while the new-chat screen is mounted
  useEffect(() => {
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  if (!project || (!candidates.length && !frequent.length)) return null;
  return (
    <div className="mt-5 flex flex-col gap-4" data-stardust-start>
      {candidates.length ? (
        <section>
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">
            {uiText("Continue working")}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {candidates.map(({ thread, status, board }, index) => (
              <ResumeTile
                key={thread.id}
                thread={thread}
                status={status}
                board={board}
                index={index}
                now={now}
                onOpen={() => open(thread)}
              />
            ))}
          </div>
        </section>
      ) : null}
      {frequent.length ? (
        <section>
          <h2
            className="mb-2 text-xs font-medium text-muted-foreground"
            aria-description={uiText(
              "Counted from user messages in the 12 most recent project conversations",
            )}
          >
            {uiText("Frequent starters")}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {frequent.map(([name, count], index) => {
              const skill = skills.find((s) => s.name === name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-description={uiText("Used {count} times", { count })}
                  className="stardust-resume-tile flex min-w-0 items-center gap-2 rounded-xl bg-card p-3 text-left shadow-sm"
                  onClick={() => {
                    const store = useComposerDraftStore.getState();
                    const existing = store.getComposerDraft(target)?.prompt ?? "";
                    store.setPrompt(target, existing ? `${existing} $${name} ` : `$${name} `);
                    document.querySelector<HTMLElement>('[data-testid="composer-editor"]')?.focus();
                  }}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{
                      background: [
                        "linear-gradient(180deg,#ffb340,#ff8a00)",
                        "linear-gradient(180deg,#5ac8fa,#007aff)",
                        "linear-gradient(180deg,#c48cff,#8e44ec)",
                      ][index],
                    }}
                  >
                    <BotIcon className="size-4" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-xs font-semibold">
                      {skill?.displayName ?? uiText("Use skill")}
                    </strong>
                    <small className="block truncate font-mono text-3xs text-muted-foreground">
                      ${name}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
export function StardustSky() {
  return (
    <div
      data-stardust-sky
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="stardust-nebula absolute inset-0" />
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="stardust-star absolute size-0.5 rounded-full bg-primary"
          style={{
            left: `${12 + ((i * 31) % 77)}%`,
            top: `${15 + ((i * 17) % 65)}%`,
            animationDelay: `${(i % 6) * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}
