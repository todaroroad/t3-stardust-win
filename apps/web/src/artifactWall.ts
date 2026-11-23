import { uiText } from "./i18n";
import type { WallArtifact } from "@t3tools/contracts";

export function artifactCheckLabel(artifact: WallArtifact): string {
  switch (artifact.verification?.status) {
    case "passed":
      return uiText("Check passed");
    case "failed":
      return uiText("Check failed");
    case "stale":
      return uiText("File updated · Run the check again");
    default:
      return uiText("File generated · No check recorded");
  }
}

function artifactTime(artifact: WallArtifact) {
  return artifact.modifiedAt ?? artifact.createdAt;
}

export function artifactCounts(artifacts: readonly WallArtifact[]) {
  const counts = { all: artifacts.length, image: 0, video: 0, page: 0, document: 0 };
  for (const a of artifacts) counts[a.kind]++;
  return counts;
}
export interface ArtifactCountState {
  key: string;
  count: number;
}
/** Returns `previous` when nothing changed so React bails out instead of re-rendering in a loop. */
export function nextArtifactCount(
  previous: ArtifactCountState | null,
  key: string,
  count: number,
): ArtifactCountState {
  return previous?.key === key && previous.count === count ? previous : { key, count };
}
export function groupArtifacts(artifacts: readonly WallArtifact[], now = new Date()) {
  const day = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const today = day(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = day(yesterdayDate);
  const groups = new Map<string, { label: string; artifacts: WallArtifact[] }>();
  for (const a of [...artifacts].sort(
    (a, b) => artifactTime(b).localeCompare(artifactTime(a)) || a.id.localeCompare(b.id),
  )) {
    const key = day(new Date(artifactTime(a)));
    const group = groups.get(key) ?? {
      label: key === today ? uiText("Today") : key === yesterday ? uiText("Yesterday") : key,
      artifacts: [],
    };
    group.artifacts.push(a);
    groups.set(key, group);
  }
  return [...groups.values()];
}
export function previousArtifactImage(selected: WallArtifact, artifacts: readonly WallArtifact[]) {
  return (
    artifacts
      .filter(
        (a) =>
          a.kind === "image" &&
          a.threadId === selected.threadId &&
          a.id !== selected.id &&
          artifactTime(a) < artifactTime(selected),
      )
      .sort(
        (a, b) => artifactTime(b).localeCompare(artifactTime(a)) || a.id.localeCompare(b.id),
      )[0] ?? null
  );
}
export const ARTIFACT_DRAG_TYPE = "application/x-t3-artifact";

export function isArtifactVideo(artifact: Pick<WallArtifact, "kind">) {
  return artifact.kind === "video";
}
export function artifactVideoDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function artifactRevisionPrompt(artifact: WallArtifact, note: string): string {
  if (!note.trim()) throw new Error(uiText("Add feedback first."));
  return [
    uiText("Update the artifact using the annotations below:"),
    JSON.stringify(
      {
        path: artifact.path,
        sourceThreadId: artifact.threadId,
        revision: artifact.revision ?? null,
        modifiedAt: artifact.modifiedAt ?? artifact.createdAt,
        sizeBytes: artifact.sizeBytes,
      },
      null,
      2,
    ),
    uiText("Feedback:"),
    note.trim(),
    uiText(
      "Before starting, verify the path, source conversation, and revision. A temporary access ID change does not mean the file changed. If you cannot verify the file or its revision changed, say so and do not guess at the old content.",
    ),
    uiText(
      "Keep the original file and save your revision as a new file. Link both images when done, describe your changes and checks, and wait for me to compare them.",
    ),
  ].join("\n");
}

/** Capability IDs expire and differ across collectors; they are not file versions. */
export function artifactVersionKey(artifact: WallArtifact): string {
  return JSON.stringify([
    artifact.threadId,
    artifact.path,
    artifact.revision ?? null,
    artifact.modifiedAt ?? artifact.createdAt,
    artifact.sizeBytes,
  ]);
}
