import type { WallArtifact } from "@t3tools/contracts";

/** Artifacts created or modified at or after the turn began, newest first. */
export function artifactsSince(
  artifacts: readonly WallArtifact[],
  sinceIso: string | null,
): WallArtifact[] {
  const since = sinceIso === null ? Number.NaN : Date.parse(sinceIso);
  if (!Number.isFinite(since)) return [];
  const touchedAt = (artifact: WallArtifact) =>
    Math.max(Date.parse(artifact.createdAt), Date.parse(artifact.modifiedAt ?? "") || 0);
  return artifacts
    .filter((artifact) => touchedAt(artifact) >= since)
    .toSorted((left, right) => touchedAt(right) - touchedAt(left));
}
