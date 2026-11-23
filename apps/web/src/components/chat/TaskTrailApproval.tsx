import { useUiText } from "~/i18n/useUiText";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ShieldCheckIcon, FilePenIcon, TerminalIcon } from "lucide-react";
import type { ProviderApprovalDecision, RuntimeRequestId } from "@t3tools/contracts";
import type { PendingApproval } from "../../session-logic";
import { approvalPresentation, approvalResultLabel } from "../../approvalPresentation";
import { approvalOptionLabel } from "../../i18n/approval";
import { fullAccessOverrideExplanation } from "@t3tools/client-runtime/state/thread-requests";
import { animateWorkbenchOnce } from "../../lib/workbenchMotion";
import { useStableCallback } from "../../hooks/useStableCallback";
import { DEFAULT_APPROVAL_OPTIONS } from "./ComposerPendingApprovalActions";

export interface TrailApprovalInput {
  readonly pending: readonly PendingApproval[];
  readonly respondingRequestIds: readonly RuntimeRequestId[];
  readonly disabled: boolean;
  readonly heldRequestIds?: ReadonlySet<string>;
  readonly onRespond: (
    id: RuntimeRequestId,
    decision: ProviderApprovalDecision,
  ) => Promise<unknown>;
}

export function ApprovalResult({ decision }: { decision: ProviderApprovalDecision }) {
  const ref = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A newly mounted server-confirmed result fades in once.
  useLayoutEffect(() => {
    if (ref.current)
      return animateWorkbenchOnce(ref.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  }, []);
  return (
    <div ref={ref} className="trail-approval-result" role="status">
      {approvalResultLabel(decision)}
    </div>
  );
}

export function TaskTrailApproval({ input }: { input: TrailApprovalInput }) {
  const approval = input.pending[0];
  return approval ? (
    <ApprovalCard key={approval.requestId} approval={approval} input={input} />
  ) : null;
}

function ApprovalCard({
  approval,
  input,
}: {
  approval: PendingApproval;
  input: TrailApprovalInput;
}) {
  const uiText = useUiText();
  const ref = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const info = approvalPresentation(approval);
  const options = approval.options ?? DEFAULT_APPROVAL_OPTIONS;
  const held = input.heldRequestIds?.has(approval.requestId) === true;
  const disabled =
    input.disabled ||
    held ||
    pending ||
    input.respondingRequestIds.includes(approval.requestId) ||
    approval.responseCapability !== "live";
  const respond = useStableCallback(async (decision: ProviderApprovalDecision) => {
    if (disabled || inFlight.current || !options.some((option) => option.decision === decision))
      return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await input.onRespond(approval.requestId, decision);
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
      setError(cause instanceof Error ? cause.message : uiText("Couldn’t submit. Try again."));
      setPending(false);
    }
    inFlight.current = false;
  });
  const onKey = useStableCallback((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.keyCode === 229 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      disabled
    )
      return;
    if (event.key !== "Enter" && event.key !== "Escape") return;
    const target = event.target instanceof Element ? event.target : null;
    const card = ref.current;
    if (!card || card.closest('[inert], [aria-hidden="true"]')) return;
    if (
      target?.closest(
        'input, textarea, [contenteditable="true"], [role="dialog"], [role="menu"], .xterm',
      )
    )
      return;
    const focused = target !== null && card.contains(target);
    if (
      !focused &&
      (input.pending.length !== 1 ||
        document.querySelectorAll('[data-approval-shortcuts="true"]').length !== 1 ||
        document.querySelector('[role="dialog"], [role="menu"]'))
    )
      return;
    if (event.key === "Enter" && target?.closest('button, a, summary, [role="button"]')) return;
    const decision = event.key === "Enter" ? "accept" : "decline";
    if (!options.some((option) => option.decision === decision)) return;
    event.preventDefault();
    event.stopPropagation();
    void respond(decision);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- A scoped keyboard listener exists only while this approval card is mounted.
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Reveal each keyed pending request once; reduced motion is handled by the shared helper.
  useLayoutEffect(() => {
    if (ref.current)
      return animateWorkbenchOnce(
        ref.current,
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 300, easing: "ease-out" },
      );
  }, []);
  const Icon =
    approval.requestKind === "command"
      ? TerminalIcon
      : approval.requestKind === "file-change"
        ? FilePenIcon
        : ShieldCheckIcon;
  const long = info.detail.length > 360 || info.detail.split("\n").length > 5;
  return (
    <div
      ref={ref}
      className="combo-decision trail-approval"
      tabIndex={0}
      role="group"
      aria-label={uiText("Permission request")}
      data-approval-shortcuts="true"
      data-approval-id={approval.requestId}
      aria-busy={pending}
    >
      <div className="trail-approval-heading">
        <Icon size={15} aria-hidden />
        <strong>{info.title}</strong>
        {input.pending.length > 1 ? (
          <span>
            {uiText("And ")}
            {input.pending.length - 1} {uiText(" more")}
          </span>
        ) : null}
      </div>
      {info.risk ? <span className="trail-approval-risk">{info.risk}</span> : null}
      {approval.appName ? <p>{approval.appName}</p> : null}
      {approval.reason ? (
        <p>
          {uiText("Why:")}
          {approval.reason}
        </p>
      ) : null}
      {info.detail ? (
        <pre
          className="trail-approval-code"
          data-expanded={expanded || !long}
          tabIndex={0}
          aria-label={uiText("Full command or path")}
        >
          <code>{info.detail}</code>
        </pre>
      ) : null}
      {long ? (
        <button
          type="button"
          className="trail-approval-expand"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? uiText("Hide details.") : uiText("Show full command or path")}
        </button>
      ) : null}
      {approval.fullAccessOverride ? (
        <p>{uiText(fullAccessOverrideExplanation(approval.fullAccessOverride))}</p>
      ) : null}
      {approval.responseCapability !== "live" ? (
        <p role="status">
          {uiText("The provider exited. Interrupt or restart it before responding.")}
        </p>
      ) : null}
      {held ? <p role="status">{uiText("Finish typing to respond to this request.")}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="trail-approval-actions">
        {options.map((option) => (
          <button
            key={option.decision}
            type="button"
            data-decision={option.decision}
            disabled={disabled}
            aria-description={option.warning}
            onClick={() => void respond(option.decision)}
          >
            {approvalOptionLabel(option.label)}
            {option.warning ? <small>{uiText(option.warning)}</small> : null}
          </button>
        ))}
      </div>
      {options.some((option) => option.decision === "accept") &&
      options.some((option) => option.decision === "decline") ? (
        <small>{uiText("↩ Approve · Esc Deny")}</small>
      ) : null}
    </div>
  );
}
