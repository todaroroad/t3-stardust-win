import type { WallArtifact } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { artifactsSince } from "./artifactShelf";

function artifact(name: string, createdAt: string, modifiedAt?: string): WallArtifact {
  return {
    id: name,
    threadId: "thread-1",
    path: `/tmp/${name}`,
    name,
    extension: "png",
    kind: "image",
    source: "file_change",
    createdAt,
    sizeBytes: 1,
    ...(modifiedAt ? { modifiedAt } : {}),
  };
}

describe("artifactsSince", () => {
  it("keeps only artifacts created or rewritten during the turn, newest first", () => {
    const list = [
      artifact("old.png", "2026-11-14T10:00:00.000Z"),
      artifact("rewritten.png", "2026-11-14T09:00:00.000Z", "2026-11-14T11:05:00.000Z"),
      artifact("new.png", "2026-11-14T11:02:00.000Z"),
    ];
    expect(artifactsSince(list, "2026-11-14T11:00:00.000Z").map((a) => a.name)).toEqual([
      "rewritten.png",
      "new.png",
    ]);
  });

  it("shows nothing when the turn has no start time", () => {
    expect(artifactsSince([artifact("a.png", "2026-11-14T11:02:00.000Z")], null)).toEqual([]);
  });
});
