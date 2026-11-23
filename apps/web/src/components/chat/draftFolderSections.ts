import { uiText } from "../../i18n";
import { isTemporaryFolder } from "../../projectMemberSelection";
import type { Project, SidebarThreadSummary } from "../../types";

type Usage = Pick<SidebarThreadSummary, "projectId" | "environmentId" | "latestUserMessageAt">;
type FolderProject = Pick<
  Project,
  "id" | "environmentId" | "title" | "workspaceRoot" | "archivedAt" | "hasCustomTitle"
>;

const RECENT_LIMIT = 5;
const MATCH_LIMIT = 30;

export function isTemporaryFolderProject(project: Pick<FolderProject, "workspaceRoot">): boolean {
  return isTemporaryFolder(project.workspaceRoot);
}

/** The shared scratch root keeps the user's own name; an unnamed one reads as a temporary chat. */
export function folderDisplayName(
  project: Pick<FolderProject, "title" | "workspaceRoot" | "hasCustomTitle">,
  isScratch: boolean,
): string {
  if (!isScratch) return project.title;
  const base =
    project.workspaceRoot
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .at(-1) ?? "";
  const generic =
    project.hasCustomTitle === false || project.title.trim() === "" || project.title === base;
  return generic ? uiText("Temporary conversation") : project.title;
}

export function draftFolderSections<T extends FolderProject>(input: {
  readonly projects: readonly T[];
  readonly threads: readonly Usage[];
  readonly query: string;
  readonly isScratch: (project: T) => boolean;
}): { recent: T[]; all: T[]; temporary: T[]; matches: T[] } {
  const lastUsed = new Map<string, number>();
  for (const thread of input.threads) {
    const at = Date.parse(String(thread.latestUserMessageAt ?? ""));
    if (!Number.isFinite(at)) continue;
    const key = `${thread.environmentId}\u0000${thread.projectId}`;
    lastUsed.set(key, Math.max(lastUsed.get(key) ?? 0, at));
  }
  const usedAt = (project: T) => lastUsed.get(`${project.environmentId}\u0000${project.id}`) ?? 0;
  const live = input.projects
    .filter((project) => project.archivedAt == null)
    .toSorted((a, b) => usedAt(b) - usedAt(a) || a.title.localeCompare(b.title, "zh-CN"));
  const temporary = live.filter(
    (project) => isTemporaryFolderProject(project) && !input.isScratch(project),
  );
  const regular = live.filter((project) => !temporary.includes(project));
  const used = regular.filter((project) => usedAt(project) > 0).slice(0, RECENT_LIMIT);
  const recent = used.length ? used : regular.slice(0, RECENT_LIMIT);
  const shown = new Set(recent);
  const all = regular.filter((project) => !shown.has(project));
  const query = input.query.trim().toLowerCase();
  const matches = query
    ? live
        .filter(
          (project) =>
            project.title.toLowerCase().includes(query) ||
            project.workspaceRoot.toLowerCase().includes(query),
        )
        .slice(0, MATCH_LIMIT)
    : [];
  return { recent, all, temporary, matches };
}
