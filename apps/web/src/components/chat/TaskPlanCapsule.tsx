import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronUpIcon } from "lucide-react";

import { useUiText } from "~/i18n/useUiText";
import type { TaskProgressSnapshot } from "../../taskProgress";
import { TaskPlanStages, completedTitle } from "./TaskPlanStages";
import {
  capsuleMode,
  currentMilestoneIndex,
  deriveMilestones,
  type CapsuleMode,
  type Milestone,
} from "./taskMilestones";
import type { TrailDetails } from "./taskTrailModel";

/** How long the finished capsule stays before it fades; hover, focus or an open panel hold it. */
const DONE_LINGER_MS = 5000;
const FADE_OUT_MS = 200;
const TITLE_SWAP_MS = 300;

export interface TaskPlanCapsuleProps {
  readonly progress: TaskProgressSnapshot;
  readonly details?: TrailDetails | undefined;
  readonly decision?: ReactNode;
  readonly approval?: { requestId: string; summary: string; card: ReactNode } | undefined;
  readonly approvalResults?: Readonly<Record<string, ReactNode>> | undefined;
  readonly onOpenFile?: ((path: string) => void) | undefined;
  /** Called once the finished capsule has faded, or at once when the plan was already finished. */
  readonly onDismissed?: (() => void) | undefined;
}

/** The step the capsule's wait belongs to: the running one, else the next, else the last. */
export function waitingStepId(progress: TaskProgressSnapshot): string | undefined {
  return (
    progress.steps.find((step) => step.status === "running")?.id ??
    progress.steps.find((step) => step.status === "pending")?.id ??
    progress.steps.at(-1)?.id
  );
}

function Ring({ mode, percent }: { mode: CapsuleMode; percent: number }) {
  return (
    <svg
      className="plan-ring"
      viewBox="0 0 18 18"
      data-mode={mode}
      style={{ "--plan-percent": percent } as CSSProperties}
      aria-hidden
    >
      <circle className="plan-ring-fill" cx="9" cy="9" r="9" />
      <circle className="plan-ring-track" cx="9" cy="9" r="7.5" />
      <circle className="plan-ring-dash" cx="9" cy="9" r="7.5" />
      <circle className="plan-ring-arc" cx="9" cy="9" r="7.5" pathLength="100" />
      <path className="plan-ring-check" d="M5.4 9.3l2.5 2.5 4.7-5" />
      <path className="plan-ring-alert" d="M9 5.2v4.4M9 12.3v.1" />
    </svg>
  );
}

export function TaskPlanCapsule({
  progress,
  details,
  decision,
  approval,
  approvalResults,
  onOpenFile,
  onDismissed,
}: TaskPlanCapsuleProps) {
  const uiText = useUiText();
  const panelId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [fading, setFading] = useState(false);
  const [hintKey, setHintKey] = useState(0);
  const approvalPending = approval !== undefined;
  const complete =
    progress.total > 0 &&
    progress.completed === progress.total &&
    progress.state === "complete" &&
    decision === undefined &&
    !approvalPending;
  const waiting =
    approvalPending ||
    decision !== undefined ||
    (!progress.stale && (progress.state === "input" || progress.state === "approval"));
  const needStep = waiting ? waitingStepId(progress) : undefined;
  const milestones = deriveMilestones({
    steps: progress.steps,
    activities: details?.activities ?? {},
    waitingStepId: needStep,
  });
  const mode = capsuleMode(milestones, {
    waiting,
    complete,
    failed: !progress.stale && progress.state === "failed",
  });
  const liveFallback = progress.planId === undefined && decision === undefined && !approvalPending;
  const currentIndex = currentMilestoneIndex(milestones);
  const current: Milestone | undefined = milestones[currentIndex];
  const finished = milestones.filter((milestone) => milestone.status === "done").length;
  const percent = milestones.length === 0 ? 0 : Math.round((finished / milestones.length) * 100);
  const completedFallbackOps = liveFallback
    ? milestones
        .filter((milestone) => milestone.status === "done")
        .reduce((sum, milestone) => sum + milestone.operations.length, 0)
    : 0;
  const title = complete
    ? completedTitle(milestones.length, details?.durationMs, uiText)
    : liveFallback && completedFallbackOps > 0 && current
      ? `${current.name} · ${uiText("{count} calls completed", { count: completedFallbackOps })}`
      : (current?.name ?? uiText("Task steps"));
  const pill =
    mode === "need"
      ? uiText("Needs confirmation")
      : mode === "problem"
        ? uiText("Problem")
        : progress.stale
          ? uiText("Status may be out of date")
          : null;

  // The old title slides out while the new one slides in; one timer clears the old one.
  const [shownTitle, setShownTitle] = useState(title);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  if (shownTitle !== title) {
    setOutgoing(shownTitle);
    setShownTitle(title);
  }
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- One timeout removes the outgoing title after its exit animation.
  useEffect(() => {
    if (outgoing === null) return;
    const timer = window.setTimeout(() => setOutgoing(null), TITLE_SWAP_MS);
    return () => window.clearTimeout(timer);
  }, [outgoing]);

  // A wait or a problem pulses once. A wait opens the panel unless the user is typing.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Reads the focused element once when attention is first needed.
  useEffect(() => {
    if (mode !== "need" && mode !== "problem") return;
    // oxlint-disable-next-line react/set-state-in-effect -- Only the rising edge into a wait or problem pulses, and the focus check reads the document.
    setHintKey((key) => key + 1);
    if (mode !== "need") return;
    const typing = document.activeElement?.closest("[data-chat-composer-form]") != null;
    if (typing) return;
    setOpen(true);
    const waitingMilestone = milestones.find((milestone) => milestone.status === "need");
    if (waitingMilestone) setOpenStage(waitingMilestone.id);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Milestones change on every progress tick; only a change of mode counts.
  }, [mode]);

  // Esc and a press outside both fold the panel; a pending approval keeps Esc for "deny".
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Document listeners exist only while the panel is open.
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || approvalPending) return;
      const inside = root?.contains(document.activeElement) ?? false;
      setOpen(false);
      if (inside) barRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && root && !root.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, approvalPending]);

  // Bring the stage that holds attention into view whenever the panel opens.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Scrolls the panel's own list after it is laid out.
  useLayoutEffect(() => {
    const list = scrollRef.current;
    const row = list?.querySelector('[data-current="true"]');
    if (!open || !list || !row) return;
    const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    list.scrollTop += top - 8;
  }, [open]);

  // A finished plan lingers, then fades; one that was finished before this view opened never shows.
  const [startedComplete] = useState(complete);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- An already finished plan is dismissed before paint.
  useLayoutEffect(() => {
    if (startedComplete) onDismissed?.();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Only the first render decides whether the plan was already finished.
  }, []);
  if (!complete && fading) setFading(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- One timeout starts the fade of a finished plan.
  useEffect(() => {
    if (!complete || startedComplete || holding || open) return;
    const timer = window.setTimeout(() => setFading(true), DONE_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [complete, startedComplete, holding, open]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- One timeout hands over to the history summary once the fade ends.
  useEffect(() => {
    if (!fading) return;
    const timer = window.setTimeout(() => onDismissed?.(), FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [fading, onDismissed]);

  const extras = (milestone: Milestone): ReactNode => {
    const results = milestone.stepIds.map((id) => approvalResults?.[id]).filter(Boolean);
    const card =
      needStep !== undefined && milestone.stepIds.includes(needStep)
        ? (approval?.card ?? decision ?? null)
        : null;
    return card === null && results.length === 0 ? null : (
      <>
        {card}
        {results}
      </>
    );
  };
  const barLabel = liveFallback
    ? [title, pill].filter((part) => part !== null).join(" · ")
    : [title, pill, `${finished}/${milestones.length}`]
        .filter((part) => part !== null)
        .join(" · ");

  return (
    <section
      ref={rootRef}
      aria-label={uiText("Task progress")}
      className="plan-capsule"
      data-plan-capsule={mode}
      data-mode={mode}
      data-open={open}
      data-fallback={liveFallback || undefined}
      data-visible={!(fading && complete)}
      inert={fading && complete}
      onPointerEnter={() => setHolding(true)}
      onPointerLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHolding(false);
      }}
    >
      <div className="plan-shadow" aria-hidden />
      <div className="plan-card">
        <span key={hintKey} className="plan-hint" data-hint={hintKey > 0} aria-hidden />
        <div className="plan-panel">
          <div className="plan-panel-clip">
            <div
              id={panelId}
              className="plan-panel-body"
              role="region"
              inert={!open}
              aria-label={liveFallback ? uiText("Live execution") : uiText("Task plan")}
            >
              <div className="plan-panel-head">
                {liveFallback ? (
                  <>
                    <strong>{uiText("Live execution")}</strong>
                    <span className="plan-head-badge" data-tone="info">
                      {uiText("No multi-stage plan")}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>{uiText("Task plan")}</strong>
                    <span className="plan-head-meta">
                      {uiText("{done}/{total} stages", {
                        done: finished,
                        total: milestones.length,
                      })}
                    </span>
                    <span className="plan-head-badge" data-tone="ok">
                      {uiText("Click stage for details")}
                    </span>
                  </>
                )}
                <span className="plan-panel-spacer" />
                <button
                  type="button"
                  className="plan-collapse-btn"
                  onClick={() => setOpen(false)}
                >
                  {uiText("Collapse")}
                </button>
                <kbd className="plan-esc-kbd">esc</kbd>
              </div>
              <div ref={scrollRef} className="plan-panel-scroll">
                <TaskPlanStages
                  milestones={milestones}
                  currentIndex={currentIndex}
                  openId={openStage}
                  onToggle={(id) => setOpenStage(openStage === id ? null : id)}
                  extras={extras}
                  onOpenFile={onOpenFile}
                  label={uiText("Reported task steps")}
                  liveFallback={liveFallback}
                />
              </div>
            </div>
          </div>
        </div>
        <button
          ref={barRef}
          type="button"
          className="plan-bar"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={barLabel}
          onClick={() => setOpen(!open)}
        >
          <Ring mode={mode} percent={complete ? 100 : percent} />
          <span className="plan-bar-ico" data-mode={mode} aria-hidden>
            {mode === "done" ? (
              <svg viewBox="0 0 16 16">
                <path d="M3.6 8.4l3 3 5.8-6.2" />
              </svg>
            ) : null}
          </span>
          <span className="plan-title" data-swapping={outgoing !== null}>
            {outgoing === null ? null : (
              <span key={outgoing} className="plan-title-out" aria-hidden>
                {outgoing}
              </span>
            )}
            <span key={title} className="plan-title-in">
              {title}
            </span>
          </span>
          {pill === null ? null : (
            <span className="plan-pill" data-tone={mode === "problem" ? "problem" : mode}>
              {pill}
            </span>
          )}
          {liveFallback ? null : (
            <>
              <span className="plan-segments" aria-hidden>
                {milestones.map((milestone) => (
                  <i key={milestone.id} data-status={milestone.status} />
                ))}
              </span>
              <span className="plan-count">
                {complete ? milestones.length : finished}/{milestones.length}
              </span>
            </>
          )}
          <ChevronUpIcon className="plan-chevron" aria-hidden />
        </button>
      </div>
    </section>
  );
}
