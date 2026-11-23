import { uiText } from "../../i18n";
import { useEffect, useRef, useState } from "react";
import { observeVisibleAnimation } from "../../lib/visibleAnimation";

const DONE_HOLD_MS = 1400;
const LEAVE_MS = 280;
const LINE_HOLD_MS = 1200;
function activityEnabled() {
  try {
    return localStorage.getItem("t3code:skin-activity:v1") !== "off";
  } catch {
    return true;
  }
}
export function SkinActivityBand(props: {
  readonly working: boolean;
  readonly subagentsSettled: number;
  readonly subagentsTotal: number;
  readonly activity?: string;
  readonly startedAt?: string | null;
}) {
  const { working, activity, startedAt, subagentsSettled, subagentsTotal } = props;
  const next = activity?.trim() || uiText("Thinking.");
  const [phase, setPhase] = useState<"hidden" | "working" | "done" | "leaving">(
    working ? "working" : "hidden",
  );
  const [line, setLine] = useState({ text: next, previous: "", revision: 0 });
  const [seconds, setSeconds] = useState(0);
  const [previousWorking, setPreviousWorking] = useState(working);
  if (previousWorking !== working) {
    setPreviousWorking(working);
    setPhase(working ? "working" : phase === "hidden" ? "hidden" : "done");
  }
  const timing = useRef({ started: 0, shown: 0, wasWorking: false });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Capture run transitions and freeze elapsed time once, without a per-frame timer.
  useEffect(() => {
    if (working) {
      timing.current.started = startedAt ? Date.parse(startedAt) : Date.now();
      timing.current.wasWorking = true;
      timing.current.shown = Date.now();
    } else if (timing.current.wasWorking) {
      timing.current.wasWorking = false;
      const elapsed = Math.max(0, Math.floor((Date.now() - timing.current.started) / 1000));
      const timer = window.setTimeout(() => setSeconds(elapsed), 0);
      return () => window.clearTimeout(timer);
    }
  }, [working, startedAt]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Coalesce incoming progress while preserving a minimum readable line duration.
  useEffect(() => {
    if (!working || next === line.text) return;
    const timer = window.setTimeout(
      () => {
        timing.current.shown = Date.now();
        setLine((old) => ({ text: next, previous: old.text, revision: old.revision + 1 }));
      },
      Math.max(0, LINE_HOLD_MS - (Date.now() - timing.current.shown)),
    );
    return () => window.clearTimeout(timer);
  }, [working, next, line.text]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Remove the outgoing line after its finite transition.
  useEffect(() => {
    if (!line.previous) return;
    const timer = window.setTimeout(() => setLine((old) => ({ ...old, previous: "" })), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [line.previous]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Completion holds briefly, fades out, then unmounts every animated layer.
  useEffect(() => {
    if (phase !== "done" && phase !== "leaving") return;
    const timer = window.setTimeout(
      () => setPhase(phase === "done" ? "leaving" : "hidden"),
      phase === "done" ? DONE_HOLD_MS : LEAVE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase]);
  if (phase === "hidden" || !activityEnabled()) return null;
  const label =
    phase === "working"
      ? line.text
      : uiText("Completed · {count} min {total} sec", {
          count: Math.floor(seconds / 60),
          total: seconds % 60,
        });
  return (
    <div className="skin-activity-anchor" aria-hidden="true">
      <div className="skin-activity-band" data-state={phase}>
        {phase !== "working" ? (
          <svg className="skin-activity-done" viewBox="0 0 16 16" width="14" height="14">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        ) : null}
        <span className="skin-activity-lines">
          {phase === "working" && line.previous ? (
            <span key={`old-${line.revision}`} className="skin-activity-old">
              {line.previous}
            </span>
          ) : null}
          <span
            key={phase === "working" ? line.revision : "done"}
            ref={phase === "working" ? observeVisibleAnimation : undefined}
            className="skin-activity-label"
            data-activity-text={label}
          >
            {label}
            {phase === "working" ? (
              <span className="skin-activity-glint">
                <span>{label}</span>
              </span>
            ) : null}
          </span>
        </span>
        {phase === "working" && subagentsTotal > 0 ? (
          <span className="skin-activity-count">
            {Math.min(subagentsSettled, subagentsTotal)}/{subagentsTotal}
          </span>
        ) : null}
      </div>
    </div>
  );
}
