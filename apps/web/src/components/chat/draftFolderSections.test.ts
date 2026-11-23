import { testUiLocale } from "../../../test/uiLocale";
import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId, ProjectId } from "@t3tools/contracts";

import {
  draftFolderSections,
  folderDisplayName,
  isTemporaryFolderProject as isTemporaryFolder,
} from "./draftFolderSections";

const local = EnvironmentId.make("local");
const project = (
  id: string,
  title: string,
  workspaceRoot: string,
  extra: { archivedAt?: string | null } = {},
) => ({
  id: ProjectId.make(id),
  environmentId: local,
  title,
  workspaceRoot,
  archivedAt: null,
  hasCustomTitle: true,
  ...extra,
});
const used = (id: string, at: string) => ({
  projectId: ProjectId.make(id),
  environmentId: local,
  latestUserMessageAt: at,
});

describe("draftFolderSections", () => {
  const projects = [
    project("scratch", "AI 工作台", "/Users/me/.t3/scratch"),
    project("codex", "Codex", "/Users/me/Documents/Codex"),
    project("dated", "Codex 会话 · 2026-10-01", "/Users/me/Documents/Codex/2026-10-01/ni-h"),
    project(
      "claude",
      "Claude 临时项目",
      "/Users/me/Library/Application Support/Claude/scratch-workspaces/a/b/scratch-1",
    ),
    project("site", "个人网站", "/Users/me/Documents/site"),
    project("old", "归档项目", "/Users/me/old", { archivedAt: "2026-01-01T00:00:00Z" }),
  ];
  const threads = [
    used("site", "2026-11-16T08:00:00Z"),
    used("scratch", "2026-11-16T10:00:00Z"),
    used("dated", "2026-11-16T11:00:00Z"),
  ];
  const isScratch = (p: { id: string }) => p.id === "scratch";

  it("lists recently used real folders first and tucks generated folders away", () => {
    using _locale = testUiLocale("zh-CN");
    const sections = draftFolderSections({ projects, threads, query: "", isScratch });
    expect(sections.recent.map((p) => p.id)).toEqual(["scratch", "site"]);
    expect(sections.all.map((p) => p.id)).toEqual(["codex"]);
    expect(sections.temporary.map((p) => p.id)).toEqual(["dated", "claude"]);
  });

  it("searches names and paths, never archived folders", () => {
    using _locale = testUiLocale("zh-CN");
    const sections = draftFolderSections({ projects, threads, query: "codex", isScratch });
    expect(sections.matches.map((p) => p.id)).toEqual(["dated", "codex"]);
    expect(draftFolderSections({ projects, threads, query: "归档", isScratch }).matches).toEqual(
      [],
    );
  });

  it("names the scratch root by its custom title, otherwise as a temporary chat", () => {
    using _locale = testUiLocale("zh-CN");
    expect(folderDisplayName(projects[0]!, true)).toBe("AI 工作台");
    expect(folderDisplayName(project("s", "scratch", "/Users/me/.t3/scratch"), true)).toBe(
      "临时对话",
    );
    expect(folderDisplayName(projects[1]!, false)).toBe("Codex");
    expect(isTemporaryFolder({ workspaceRoot: "/" })).toBe(true);
    expect(isTemporaryFolder({ workspaceRoot: "/Users/me/.t3/scratch/2026-11-14-x" })).toBe(true);
    expect(isTemporaryFolder({ workspaceRoot: "/Users/me/.t3/scratch" })).toBe(false);
  });
});
