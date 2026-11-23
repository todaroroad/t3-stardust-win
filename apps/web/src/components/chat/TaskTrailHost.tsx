import type { ComponentProps } from "react";
import { ThreadTaskTrail } from "./ThreadTaskTrail";
import { usePendingUserInputDraft } from "./usePendingThreadRequests";
import type { TrailDecisionInput } from "./TaskTrailDecision";

export function TaskTrailHost({
  scope,
  onSelect,
  onAdvance,
  onFocus,
  decisionDisabled,
  ...props
}: ComponentProps<typeof ThreadTaskTrail> & {
  scope: Parameters<typeof usePendingUserInputDraft>[0];
  onSelect: TrailDecisionInput["onSelect"];
  onAdvance: TrailDecisionInput["onAdvance"];
  onFocus: TrailDecisionInput["onFocus"];
  decisionDisabled: boolean;
}) {
  const { activePendingProgress } = usePendingUserInputDraft(scope);
  const question = activePendingProgress?.activeQuestion;
  const pending = scope.activePendingUserInput;
  return (
    <ThreadTaskTrail
      {...props}
      {...(pending && question
        ? {
            decision: {
              requestId: pending.requestId,
              question,
              selectedValues: activePendingProgress.selectedOptionValues,
              disabled: decisionDisabled,
              canAdvance: activePendingProgress.canAdvance,
              onSelect,
              onAdvance,
              onFocus,
            },
          }
        : {})}
    />
  );
}
