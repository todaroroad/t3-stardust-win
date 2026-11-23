import { useState, type ReactNode } from "react";
import type { ScopedThreadRef } from "@t3tools/contracts";
import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { TaskProgressSnapshot } from "../../taskProgress";
import { TaskPlanCapsule, waitingStepId } from "./TaskPlanCapsule";
import { taskTrailDetails, type TrailDetails } from "./taskTrailModel";
import { TaskTrailDecision, type TrailDecisionInput } from "./TaskTrailDecision";
import { useWallArtifacts } from "../../useWallArtifacts";
import { approvalPresentation, trailApprovalResults } from "../../approvalPresentation";
import { TaskTrailApproval, ApprovalResult, type TrailApprovalInput } from "./TaskTrailApproval";
import { artifactFileUrl } from "../../lib/artifactWallClient";

export function ThreadTaskTrail({
  threadRef,
  progress,
  projection = null,
  details,
  decision,
  approvals,
  onOpenFile,
  onDismissed,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly progress: TaskProgressSnapshot;
  readonly projection?: ThreadStructure | null;
  readonly details?: TrailDetails | undefined;
  readonly decision?: TrailDecisionInput;
  readonly approvals?: TrailApprovalInput;
  readonly onOpenFile?: (path: string) => void;
  readonly onDismissed?: () => void;
}) {
  const artifacts = useWallArtifacts(
    threadRef.environmentId,
    threadRef.threadId,
    "thread",
    decision !== undefined,
  );
  const images: Record<string, string> = {};
  for (const option of decision?.question.options ?? []) {
    const request = projection?.turnItems.find(
      (item) => item.type === "user_input_request" && item.requestId === decision?.requestId,
    );
    const preview =
      request?.type === "user_input_request"
        ? request.questions
            .find((question) => question.id === decision?.question.id)
            ?.options.find(
              (entry) => (entry.value ?? entry.label) === (option.value ?? option.label),
            )?.preview
        : undefined;
    const references = [
      option.value,
      preview,
      ...((preview ?? "").match(/!\[[^\]]*\]\(([^)]+)\)/)?.slice(1) ?? []),
    ];
    const matches = artifacts.artifacts.filter(
      (artifact) =>
        artifact.kind === "image" &&
        references.some((reference) => reference === artifact.id || reference === artifact.path),
    );
    if (matches.length !== 1) continue;
    const url = artifactFileUrl(threadRef.environmentId, matches[0]!.id);
    if (url) images[option.value ?? option.label] = url;
  }
  const approval = approvals?.pending[0];
  const results = trailApprovalResults(projection, progress);
  const stepId = waitingStepId(progress);
  const [bindings, setBindings] = useState<{
    planId: string | undefined;
    steps: Record<string, string>;
  }>({ planId: progress.planId, steps: {} });
  const boundSteps = bindings.planId === progress.planId ? bindings.steps : {};
  const unbound = [...(approvals?.pending ?? []), ...results].filter(
    (request) => !boundSteps[request.requestId],
  );
  if (stepId && (bindings.planId !== progress.planId || unbound.length > 0)) {
    setBindings({
      planId: progress.planId,
      steps: {
        ...boundSteps,
        ...Object.fromEntries(unbound.map((request) => [request.requestId, stepId])),
      },
    });
  }
  const resultsByStep: Record<string, ReactNode> = {};
  for (const step of progress.steps) {
    const entries = results.filter((result) => boundSteps[result.requestId] === step.id);
    if (entries.length)
      resultsByStep[step.id] = (
        <>
          {entries.map((result) => (
            <ApprovalResult key={result.requestId} decision={result.decision} />
          ))}
        </>
      );
  }
  return (
    <TaskPlanCapsule
      progress={progress}
      details={details ?? taskTrailDetails(progress, projection)}
      {...(approval && approvals
        ? {
            approval: {
              requestId: approval.requestId,
              summary: approvalPresentation(approval).summary,
              card: <TaskTrailApproval input={approvals} />,
            },
          }
        : {})}
      {...(results.length ? { approvalResults: resultsByStep } : {})}
      {...(onOpenFile ? { onOpenFile } : {})}
      {...(onDismissed ? { onDismissed } : {})}
      {...(decision
        ? {
            decision: (
              <TaskTrailDecision
                key={`${decision.requestId}:${decision.question.id}`}
                input={decision}
                images={images}
              />
            ),
          }
        : {})}
    />
  );
}
