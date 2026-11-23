import { uiText } from "./i18n";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { TaskProgressSnapshot } from "./taskProgress";
import type { BoardTask } from "./taskBoard.logic";
import { boardTaskKind } from "./taskBoard.logic";
import type { SidebarThreadSummary } from "./types";
import { attentionTimestamp } from "./sidebarInboxPresentation";

export interface ResumeRequest {
  readonly key: string;
  readonly token: string;
  readonly ref: ScopedThreadRef;
  readonly title: string;
  readonly reason: string;
  readonly attention?: string;
  readonly boardFolder?: string;
}

export function threadResumeToken(thread: SidebarThreadSummary, reason: string) {
  return JSON.stringify([reason, attentionTimestamp(thread), thread.latestRun?.runId]);
}

export function linkedBoardThread(task: BoardTask, threads: readonly SidebarThreadSummary[]) {
  return (
    threads
      .filter(
        (thread) => !thread.deletedAt && !thread.archivedAt && task.sessions.includes(thread.id),
      )
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

export function boardResumeToken(task: BoardTask) {
  return JSON.stringify([
    task.notify_key,
    task.state,
    task.current_id,
    task.judge,
    task.blocked,
    task.next,
    task.steps,
  ]);
}

export function boardResumeReason(task: BoardTask) {
  if (task.state === "blocked") return "需要解锁";
  const kind = boardTaskKind(task);
  return kind === "review" ? "待验收" : kind === "decide" ? "待决定" : "待回答";
}

const REQUEST_PATTERN =
  /请(?!求|教)|需要你|你需要|你可以|你来|是否|能否|要不要|告诉我|你选|确认一下|[？?]$|\bplease\b|\bcould you\b|\bcan you\b/i;

export function lastRequestSentence(text: string | undefined) {
  if (!text) return null;
  // Only the closing paragraphs carry the ask; quoted terms (“需要你”) are labels, not requests.
  const tail = text
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(-3)
    .join("\n");
  return (
    tail
      .split(/\n|(?<=[。！？?!])\s*/u)
      .map((line) =>
        line
          .replace(/^[\s#*>-]+/, "")
          .replace(/\*\*|__|`/g, "")
          .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
          .trim(),
      )
      .filter((line) => line.length > 0 && line.length <= 80)
      .filter((line) => REQUEST_PATTERN.test(line.replace(/[“"「『][^”"」』]*[”"」』]/g, "")))
      .at(-1) ?? null
  );
}

export function resumeCardDetails(
  request: ResumeRequest,
  progress: TaskProgressSnapshot | null,
  lastAssistant?: string,
  board?: BoardTask | null,
) {
  const steps = progress?.steps.length
    ? progress.steps
    : (board?.steps.map((step) => ({
        id: step.id,
        text: step.name,
        status: step.done
          ? ("completed" as const)
          : step.id === board.current_id
            ? ("running" as const)
            : ("pending" as const),
      })) ?? []);
  const inProgress = steps.findIndex((step) => step.status === "running");
  const currentIndex =
    inProgress >= 0 ? inProgress : steps.findIndex((step) => step.status !== "completed");
  const displayedIndex = currentIndex < 0 ? steps.length - 1 : currentIndex;
  const current = steps[displayedIndex];
  const blocked = board?.blocked?.trim() || request.attention?.trim() || null;
  // “你要做” must add information: skip candidates that merely repeat “卡在”.
  const failed = request.reason === "运行失败";
  const action =
    [
      board?.judge?.trim(),
      board?.next?.trim(),
      failed
        ? uiText("Check the error, address it, then continue to retry")
        : lastRequestSentence(lastAssistant),
      request.attention?.trim(),
    ].find((candidate) => candidate && candidate !== blocked) ?? null;
  return {
    steps,
    currentIndex,
    reached: current
      ? uiText("Step {count}/{total} · {text}", {
          count: displayedIndex + 1,
          total: steps.length,
          text: current.text,
        })
      : null,
    blocked,
    action,
    after: currentIndex >= 0 ? (steps[currentIndex + 1]?.text ?? null) : null,
  };
}

export function resumeRequestHidden(
  key: string,
  token: string,
  hidden: Readonly<Record<string, string>>,
  until: Readonly<Record<string, number>>,
  now: number,
) {
  return hidden[key] === token && (until[key] === undefined || until[key]! > now);
}
