import { uiText } from "../../i18n";
import { inboxReason } from "~/workbenchInbox";
import { boardResumeReason, linkedBoardThread } from "~/resumeCard";
import type { InboxThreadRequest } from "~/taskBoard";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { ScopedProjectRef } from "@t3tools/contracts";
import type { BoardTask } from "~/taskBoard.logic";
export function startThreadStatus(
  thread: EnvironmentThreadShell,
  boards: readonly BoardTask[],
  requests: readonly Pick<InboxThreadRequest, "ref" | "reason">[] = [],
  threads: readonly EnvironmentThreadShell[] = [thread],
) {
  if (thread.deletedAt || thread.archivedAt) return null;
  const published = requests.find(
    (request) =>
      request.ref.environmentId === thread.environmentId && request.ref.threadId === thread.id,
  );
  if (published) return published.reason;
  const board = startThreadBoard(thread, boards, threads);
  if (board) return boardResumeReason(board);
  const reason = inboxReason(thread);
  if (reason) return reason;
  if (
    ["preparing", "queued", "starting", "running", "waiting"].includes(thread.runtime?.status ?? "")
  )
    return uiText("In progress");
  return null;
}
export function startThreadBoard(
  thread: EnvironmentThreadShell,
  boards: readonly BoardTask[],
  threads: readonly EnvironmentThreadShell[],
) {
  return boards.find(
    (board) =>
      !board.snoozed &&
      ["user", "blocked"].includes(board.state) &&
      linkedBoardThread(board, threads)?.id === thread.id,
  );
}
export function startRelativeTime(
  iso: string,
  now: number,
  text: (key: string, vars?: Record<string, number>) => string,
) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (!Number.isFinite(minutes) || minutes < 1) return text("Just now");
  if (minutes < 60) return text("{count} minutes ago", { count: minutes });
  if (minutes < 1440) return text("{count} hours ago", { count: Math.floor(minutes / 60) });
  return text("{count} days ago", { count: Math.floor(minutes / 1440) });
}
export function recentProjectThreads(
  threads: readonly EnvironmentThreadShell[],
  project: ScopedProjectRef | null,
) {
  return project
    ? threads
        .filter(
          (t) =>
            t.environmentId === project.environmentId &&
            t.projectId === project.projectId &&
            !t.deletedAt &&
            !t.archivedAt,
        )
        .toSorted((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    : [];
}
export function skillFrequency(
  messages: readonly { role: string; text: string }[],
  known: ReadonlySet<string>,
) {
  const counts = new Map<string, number>();
  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const match of message.text.matchAll(/(?:^|\s)\$([a-zA-Z0-9][a-zA-Z0-9:_-]*)/g)) {
      const name = match[1];
      if (name && known.has(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts].toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
}
