import { useUiText } from "~/i18n/useUiText";
import { Tooltip, TooltipTrigger, TooltipPopup } from "../ui/tooltip";
import { useState, useEffect } from "react";
import { Clock3Icon, MoreHorizontalIcon, XIcon, CheckIcon } from "lucide-react";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { backgroundWorkDefersThreadCompletion } from "@t3tools/shared/orchestrationV2PendingBackgroundWork";
import { useResumeCardStore } from "../../resumeCardStore";
import { useTaskBoard, mutateTaskBoard } from "../../taskBoard";
import { boardCurrentStep } from "../../taskBoard.logic";
import {
  boardResumeReason,
  boardResumeToken,
  resumeCardDetails,
  resumeRequestHidden,
  threadResumeToken,
} from "../../resumeCard";
import { useNowMinute } from "../../hooks/useNowMinute";
import { useQuietThreadProjection, useQuietThreadShell } from "../../state/entities";
import { taskProgressSnapshot } from "../../taskProgress";
import { useWallArtifacts } from "../../useWallArtifacts";
import { artifactsSince } from "../../artifactShelf";
import {
  dismissInboxRequest,
  inboxStripCopy,
  inboxStripState,
  nextInboxMorning,
} from "../../inboxStrip";
import { useInboxExitRows } from "../../lib/workbenchMotion";
import { useInspectorTab } from "../../inspectorTabs";
import { requestOpenThreadPanel } from "../../threadPanelBus";
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator } from "../ui/menu";

export function InboxStrip({
  threadRef,
  prompt,
  disabled,
  onContinue,
}: {
  threadRef: ScopedThreadRef;
  prompt: string;
  disabled: boolean;
  onContinue: () => void | Promise<void>;
}) {
  const uiText = useUiText();
  const key = scopedThreadKey(threadRef);
  const selected = useResumeCardStore((state) => state.selected[key]);
  const hidden = useResumeCardStore((state) => state.hidden);
  const until = useResumeCardStore((state) => state.hiddenUntil);
  const tasks = useTaskBoard((state) => (state.error ? undefined : state.data?.tasks));
  const board = selected?.boardFolder
    ? tasks?.find((task) => task.folder === selected.boardFolder)
    : undefined;
  const request =
    selected && board
      ? { ...selected, token: boardResumeToken(board), reason: boardResumeReason(board) }
      : selected;
  const now = Date.parse(`${useNowMinute()}:00Z`);
  const shell = useQuietThreadShell(threadRef);
  const projection = useQuietThreadProjection(threadRef)?.projection ?? null;
  const wall = useWallArtifacts(
    threadRef.environmentId,
    threadRef.threadId,
    "thread",
    Boolean(shell?.latestRun),
  );
  const artifacts = artifactsSince(wall.artifacts, shell?.latestRun?.requestedAt ?? null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Register the real completed turn's artifact attention with the shared inbox store.
  useEffect(() => {
    if (!shell || shell.latestRun?.status !== "completed" || !artifacts.length) return;
    if (backgroundWorkDefersThreadCompletion(shell)) return;
    // A sub-agent's result is delivered to its parent; opening the child must not create a
    // second Needs-you item the user has to dismiss by hand.
    if (shell.lineage.relationshipToParent === "subagent") return;
    if (
      selected &&
      (selected.boardFolder || selected.token === threadResumeToken(shell, selected.reason))
    )
      return;
    const reason = "有新结果";
    const request = {
      key,
      token: threadResumeToken(shell, reason),
      ref: threadRef,
      title: shell.title,
      reason,
    };
    if (!resumeRequestHidden(request.key, request.token, hidden, until, now))
      useResumeCardStore.getState().open(request);
  }, [selected, shell, artifacts.length, key, threadRef, hidden, until, now]);
  const progress = taskProgressSnapshot(projection, shell, !disabled);
  // V14: a new result is announced once, in the sidebar; the composer no longer repeats it with
  // a "View outputs" strip (outputs stay in the inspector's Outputs tab). Requests that need an
  // answer (approval, input, blocked board steps) still show here.
  const visible =
    request &&
    inboxStripState(request.reason) !== "new" &&
    (!shell || request.boardFolder || request.token === threadResumeToken(shell, request.reason)) &&
    !resumeRequestHidden(request.key, request.token, hidden, until, now) &&
    (!board || (!board.snoozed && ["user", "blocked"].includes(board.state)));
  const rows = visible ? [{ key: request.key, request, board }] : [];
  const exiting = useInboxExitRows(rows, new Set(rows.map((row) => row.key)));
  const [, setInspectorTab] = useInspectorTab();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const busy = false;
  return [...rows, ...exiting].map((row) => {
    const kind = inboxStripState(row.request.reason);
    const copy = inboxStripCopy[kind];
    const details = resumeCardDetails(row.request, progress, undefined, row.board);
    const sentence =
      details.action ??
      details.blocked ??
      (artifacts.length
        ? uiText("{count} files ready · {name}", {
            count: artifacts.length,
            name: artifacts[0]?.name,
          })
        : (row.request.attention ?? row.request.title));
    const leaving = !rows.some((current) => current.key === row.key);
    return (
      <div
        key={`${row.key}:${row.request.token}`}
        className={`inbox-strip-wrap${leaving ? " inbox-strip-leaving" : ""}`}
        inert={leaving}
        aria-hidden={leaving || undefined}
        data-inbox-strip={kind}
      >
        <div className="inbox-strip-line">
          <span className={`inbox-strip-dot inbox-strip-dot-${kind}`} />
          <strong>{uiText(copy.title)}</strong>
          <Tooltip>
            <TooltipTrigger render={<span className="inbox-strip-sentence" />}>
              {sentence}
            </TooltipTrigger>
            <TooltipPopup>{sentence}</TooltipPopup>
          </Tooltip>
          <button
            type="button"
            className="inbox-strip-link"
            onClick={() => {
              if (kind === "block") setDetailsOpen(!detailsOpen);
              else {
                setInspectorTab("artifacts");
                requestOpenThreadPanel();
              }
            }}
          >
            {uiText(copy.link)}
          </button>
          <button
            type="button"
            className="inbox-strip-primary"
            disabled={busy || disabled || (kind === "block" && row.request.reason === "待授权")}
            onClick={() => {
              if (busy) return;
              dismissInboxRequest(row.request, undefined, async () => {
                if (kind === "check" && row.board) {
                  const step = boardCurrentStep(row.board);
                  if (!step)
                    throw new Error(uiText("No step is ready for review. Refresh and try again."));
                  await mutateTaskBoard("review", {
                    folder: row.board.folder,
                    step: step.id,
                    decision: "approve",
                  });
                }
                if (kind === "block") await onContinue();
              });
            }}
          >
            {uiText(copy.primary)}
          </button>
          <Menu>
            <MenuTrigger
              render={
                <button
                  type="button"
                  className="inbox-strip-icon"
                  aria-label={uiText("Remind me later or dismiss")}
                  disabled={busy}
                >
                  <MoreHorizontalIcon />
                </button>
              }
            />
            <MenuPopup side="top" align="end">
              <MenuItem onClick={() => dismissInboxRequest(row.request, Date.now() + 3600000)}>
                <Clock3Icon />
                {uiText("Remind me in one hour")}
              </MenuItem>
              <MenuItem
                onClick={() => dismissInboxRequest(row.request, nextInboxMorning(new Date()))}
              >
                <Clock3Icon />
                {uiText("Remind me tomorrow morning")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem onClick={() => dismissInboxRequest(row.request)}>
                {uiText("Dismiss from Needs you")}
              </MenuItem>
            </MenuPopup>
          </Menu>
          <button
            type="button"
            className="inbox-strip-icon"
            aria-label={uiText("Dismiss from Needs you")}
            disabled={busy}
            onClick={() => dismissInboxRequest(row.request)}
          >
            <XIcon />
          </button>
        </div>
        {detailsOpen && kind === "block" ? (
          <div className="inbox-strip-details">
            {details.reached ? (
              <p>{uiText("Progress: {text}", { text: details.reached })}</p>
            ) : null}
            {details.blocked ? <p>{uiText("Blocked: {text}", { text: details.blocked })}</p> : null}
            {details.action ? (
              <p>{uiText("Your action: {text}", { text: details.action })}</p>
            ) : null}
            {details.after ? <p>{uiText("Next: {text}", { text: details.after })}</p> : null}
            {row.request.reason === "待授权" ? (
              <p>{uiText("Review the request, then approve or deny it in the permission card.")}</p>
            ) : null}
          </div>
        ) : null}
        {prompt.trim() && !leaving ? (
          <div className="inbox-strip-hint">
            <CheckIcon />
            {uiText(copy.hint)}
          </div>
        ) : null}
      </div>
    );
  });
}
