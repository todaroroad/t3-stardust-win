import { inboxLabel } from "~/i18n/inboxLabel";
import { uiText } from "../../i18n";
import type { PendingApproval } from "../../session-logic";
import type { ProviderApprovalDecision, RuntimeRequestId } from "@t3tools/contracts";
import { approvalPresentation } from "../../approvalPresentation";
import { DEFAULT_APPROVAL_OPTIONS } from "./ComposerPendingApprovalActions";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useState } from "react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { TaskProgressSnapshot } from "../../taskProgress";
import {
  boardResumeReason,
  boardResumeToken,
  resumeCardDetails,
  resumeRequestHidden,
  type ResumeRequest,
} from "../../resumeCard";
import { useResumeCardStore } from "../../resumeCardStore";
import { mutateTaskBoard, useTaskBoard } from "../../taskBoard";
import type { BoardTask } from "../../taskBoard.logic";
import { useInboxExitRows } from "../../lib/workbenchMotion";
import { Button } from "../ui/button";
import { ComposerBanner } from "./ComposerBanner";

export function ResumeCard({
  request,
  progress,
  lastAssistant,
  board,
  leaving = false,
  disabled = false,
  onContinue,
  onSnooze,
  onDismiss,
  approval,
  approvalDisabled,
  onApprove,
}: {
  approval?: PendingApproval | null | undefined;
  approvalDisabled?: boolean | undefined;
  onApprove?: (() => Promise<unknown>) | undefined;
  request: ResumeRequest;
  progress: TaskProgressSnapshot | null;
  lastAssistant?: string | undefined;
  board?: BoardTask | null | undefined;
  leaving?: boolean;
  disabled?: boolean;
  onContinue: () => Promise<void>;
  onSnooze: () => Promise<void | number>;
  onDismiss?: (() => Promise<void>) | undefined;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseDetails = resumeCardDetails(request, progress, lastAssistant, board);
  const details = approval
    ? {
        ...baseDetails,
        blocked: approvalPresentation(approval).summary,
        action: uiText("Approve or deny the request"),
        after: uiText("The agent continues after approval or adapts after denial"),
      }
    : baseDetails;
  const canApprove =
    approval &&
    (approval.options ?? DEFAULT_APPROVAL_OPTIONS).some((option) => option.decision === "accept");
  const approve = async () => {
    if (pending || !onApprove || approvalDisabled || approval?.responseCapability !== "live")
      return;
    setPending(true);
    setError(null);
    try {
      const result = await onApprove();
      if (
        !result ||
        typeof result !== "object" ||
        !("_tag" in result) ||
        result._tag !== "Success"
      ) {
        setError(
          uiText("The request hasn’t been submitted. Retry or check the conversation error."),
        );
        setPending(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : uiText("Something went wrong. Try again."));
      setPending(false);
    }
  };
  const act = async (action: () => Promise<void | number>) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const until = await action();
      useResumeCardStore.getState().hide(request, typeof until === "number" ? until : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : uiText("Something went wrong. Try again."));
    }
    setPending(false);
  };
  return (
    <div
      data-resume-card=""
      inert={leaving}
      aria-hidden={leaving || undefined}
      className={leaving ? "workbench-inbox-exit" : "resume-card-enter mb-2"}
    >
      <ComposerBanner.Root detached density="spacious">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{request.title}</span>
          <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
            {inboxLabel(approval ? "待授权" : request.reason)}
          </span>
        </div>
        {details.steps.length > 0 ? (
          <div
            className="my-2.5 flex h-1 gap-1"
            data-resume-steps
            aria-label={uiText("Task steps")}
          >
            {details.steps.map((step, index) => (
              <span
                key={step.id}
                className={`flex-1 rounded-full ${step.status === "completed" ? "bg-foreground" : index === details.currentIndex ? "bg-warning" : "bg-border"}`}
              />
            ))}
          </div>
        ) : null}
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs leading-relaxed">
          {details.reached ? (
            <>
              <dt className="text-muted-foreground">{uiText("Reached ")}</dt>
              <dd className="min-w-0 break-words">{details.reached}</dd>
            </>
          ) : null}
          {details.blocked ? (
            <>
              <dt className="text-muted-foreground">{uiText("Blocked at ")}</dt>
              <dd className="min-w-0 break-words">{details.blocked}</dd>
            </>
          ) : null}
          {details.action ? (
            <>
              <dt className="text-muted-foreground">{uiText("Your action ")}</dt>
              <dd className="min-w-0 break-words font-semibold">{details.action}</dd>
            </>
          ) : null}
          {details.after ? (
            <>
              <dt className="text-muted-foreground">{uiText("Next ")}</dt>
              <dd className="min-w-0 break-words text-muted-foreground">{details.after}</dd>
            </>
          ) : null}
        </dl>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {approval ? (
            canApprove ? (
              <Button
                size="sm"
                disabled={approvalDisabled || pending || approval.responseCapability !== "live"}
                onClick={() => void approve()}
              >
                {pending ? uiText("Working….") : uiText("Approve")}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                {uiText("Choose an available option in the permission request")}
              </span>
            )
          ) : (
            <Button size="sm" disabled={disabled || pending} onClick={() => void act(onContinue)}>
              {pending ? uiText("Working….") : uiText("I’m done. Continue")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || pending}
            onClick={() => void act(onSnooze)}
          >
            {uiText("Remind me later")}
          </Button>
          {onDismiss && !approval ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled || pending}
              onClick={() => void act(onDismiss)}
            >
              {uiText("Skip this")}
            </Button>
          ) : null}
        </div>
      </ComposerBanner.Root>
    </div>
  );
}

export function ThreadResumeCard({
  threadRef,
  progress,
  lastAssistant,
  disabled,
  onContinue,
  onSnooze,
  onDismiss,
  approval,
  approvalDisabled,
  onRespondToApproval,
}: {
  approval?: PendingApproval | null | undefined;
  approvalDisabled?: boolean | undefined;
  onRespondToApproval?: (
    id: RuntimeRequestId,
    decision: ProviderApprovalDecision,
  ) => Promise<unknown>;
  threadRef: ScopedThreadRef;
  progress: TaskProgressSnapshot | null;
  lastAssistant?: string | undefined;
  disabled: boolean;
  onContinue: (text: string) => Promise<void>;
  onSnooze: (() => Promise<void | number>) | undefined;
  onDismiss: (() => Promise<void>) | undefined;
}) {
  const selected = useResumeCardStore((state) => state.selected[scopedThreadKey(threadRef)]);
  const boardTasks = useTaskBoard((state) => (state.error ? null : state.data?.tasks));
  const board = selected?.boardFolder
    ? boardTasks?.find((task) => task.folder === selected.boardFolder)
    : null;
  const request =
    selected && board
      ? { ...selected, token: boardResumeToken(board), reason: boardResumeReason(board) }
      : selected;
  const hidden = useResumeCardStore((state) => state.hidden);
  const hiddenUntil = useResumeCardStore((state) => state.hiddenUntil);
  const now = Date.parse(`${useNowMinute()}:00Z`);
  const visible =
    request &&
    (request.reason !== "待授权" || Boolean(approval)) &&
    !resumeRequestHidden(request.key, request.token, hidden, hiddenUntil, now) &&
    (!board || (!board.snoozed && ["user", "blocked"].includes(board.state)));
  const rows = visible ? [{ key: request.key, request, board }] : [];
  const exiting = useInboxExitRows(rows, new Set(rows.map((row) => row.key)));
  const snooze = async () => {
    if (board) {
      const until = Date.now() + 3600000;
      await mutateTaskBoard("snooze", {
        folder: board.folder,
        until: new Date(until).toISOString(),
      });
      return until;
    }
    return onSnooze?.();
  };
  return [...rows, ...exiting].map((row) => (
    <ResumeCard
      key={`${row.key}:${approval?.requestId ?? ""}`}
      request={row.request}
      approval={approval}
      approvalDisabled={approvalDisabled}
      onApprove={
        approval && onRespondToApproval
          ? () => onRespondToApproval(approval.requestId, "accept")
          : undefined
      }
      board={row.board}
      progress={progress}
      lastAssistant={lastAssistant}
      leaving={!visible}
      disabled={disabled}
      onContinue={() => onContinue(uiText("I’ve taken care of it. Continue."))}
      onSnooze={snooze}
      onDismiss={row.board ? undefined : onDismiss}
    />
  ));
}
