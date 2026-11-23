import { useId, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { useUiText } from "~/i18n/useUiText";
import type { TaskProgressSnapshot } from "../../taskProgress";
import { TaskPlanStages, completedTitle } from "./TaskPlanStages";
import { currentMilestoneIndex, deriveMilestones } from "./taskMilestones";
import type { TrailDetails } from "./taskTrailModel";

/** What the floating capsule leaves in the conversation once it has faded: one row to reopen. */
export function TaskPlanSummary({
  progress,
  details,
  onOpenFile,
}: {
  readonly progress: TaskProgressSnapshot;
  readonly details?: TrailDetails | undefined;
  readonly onOpenFile?: ((path: string) => void) | undefined;
}) {
  const uiText = useUiText();
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const [openStage, setOpenStage] = useState<string | null>(null);
  const milestones = deriveMilestones({
    steps: progress.steps,
    activities: details?.activities ?? {},
  });
  return (
    <div className="chat-content-lane pb-3" data-task-plan-summary="true">
      <section aria-label={uiText("Task progress")} className="plan-summary" data-open={open}>
        <button
          type="button"
          className="plan-summary-bar"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
        >
          <span className="plan-summary-check" aria-hidden>
            <CheckIcon />
          </span>
          <span className="plan-summary-title">
            {completedTitle(milestones.length, details?.durationMs, uiText)}
          </span>
          <ChevronDownIcon className="plan-summary-chevron" aria-hidden />
        </button>
        <div id={bodyId} className="plan-summary-body" inert={!open}>
          <div className="plan-summary-clip">
            <div className="plan-summary-scroll">
              <TaskPlanStages
                milestones={milestones}
                currentIndex={currentMilestoneIndex(milestones)}
                openId={openStage}
                onToggle={(id) => setOpenStage(openStage === id ? null : id)}
                onOpenFile={onOpenFile}
                label={uiText("Reported task steps")}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
