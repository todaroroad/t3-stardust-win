import { isContinuationSegment, type ContinuationSegment } from "./continuationHistory";
import type { InspectorTab } from "../../inspectorTabs";
export function availableInspectorTabs(input: {
  hasArtifacts: boolean;
  hasHistory: boolean;
  hasSubtasks: boolean;
  hasProject: boolean;
}): InspectorTab[] {
  return [
    ...(input.hasArtifacts ? ["artifacts" as const] : []),
    ...(input.hasHistory ? ["history" as const] : []),
    ...(input.hasSubtasks ? ["subtasks" as const] : []),
    ...(input.hasProject ? ["project" as const] : []),
  ];
}

export function hasContinuationRecords(
  thread: ContinuationSegment,
  candidates: readonly ContinuationSegment[],
): boolean {
  return (
    isContinuationSegment(thread) &&
    (!!thread.continuedFromThreadId ||
      candidates.some(
        (candidate) =>
          candidate.id !== thread.id &&
          candidate.deletedAt === null &&
          isContinuationSegment(candidate) &&
          candidate.continuedFromThreadId === thread.id,
      ))
  );
}
