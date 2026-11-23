import { inboxLabel } from "~/i18n/inboxLabel";
import { uiText } from "../../i18n";
import { derivePendingThreadRequests } from "@t3tools/client-runtime/state/thread-requests";
import { approvalPresentation } from "../../approvalPresentation";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { SidebarThreadSummary } from "../../types";
import type { BoardTask } from "../../taskBoard.logic";
import { useQuietThreadProjection, useThreadShell } from "../../state/entities";
import { taskProgressSnapshot } from "../../taskProgress";
import { resumeCardDetails, lastRequestSentence } from "../../resumeCard";

export function InboxProgress({
  thread,
  board,
  reason,
  detail,
}: {
  thread: SidebarThreadSummary;
  board: BoardTask | null;
  reason: string;
  detail: string | null;
}) {
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  const projection = useQuietThreadProjection(ref)?.projection ?? null;
  const shell = useThreadShell(ref);
  const progress = taskProgressSnapshot(projection, shell);
  const model = resumeCardDetails(
    { key: "", token: "", ref, title: "", reason },
    progress,
    undefined,
    board,
  );
  const approval =
    projection && reason === "待授权"
      ? derivePendingThreadRequests(projection).approvals.toSorted((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        )[0]
      : undefined;
  const summary =
    board || reason === "运行失败"
      ? detail
      : (lastRequestSentence(
          projection?.messages.findLast((message) => message.role === "assistant")?.text,
        ) ?? detail);
  return (
    <>
      <span className="block truncate text-xs text-sidebar-muted-foreground">
        <span className={reason === "运行失败" ? "text-destructive" : "text-warning"}>
          {inboxLabel(reason)}
        </span>
        {approval
          ? ` · ${approvalPresentation(approval).summary}`
          : model.reached || summary
            ? ` · ${model.reached ?? summary}`
            : ""}
      </span>
      {model.steps.length > 0 ? (
        <span
          aria-label={uiText("{count}/{total} steps completed", {
            count: model.steps.filter((step) => step.status === "completed").length,
            total: model.steps.length,
          })}
          className="mt-1 flex h-0.75 gap-0.5 overflow-hidden rounded-full"
        >
          {model.steps.map((step, index) => (
            <span
              key={step.id}
              className={`h-full flex-1 ${step.status === "completed" ? "bg-sidebar-foreground" : index === model.currentIndex ? "bg-warning" : "bg-sidebar-border"}`}
            />
          ))}
        </span>
      ) : null}
    </>
  );
}
