import type { EnvironmentServerConfig } from "@t3tools/client-runtime/connection";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { isThreadWorking } from "@t3tools/client-runtime/state/thread-inbox";
import type { ContextMenuItem, EnvironmentId } from "@t3tools/contracts";
import { FolderPlusIcon, LayersIcon, PinIcon } from "lucide-react";
import { memo, type MouseEvent as ReactMouseEvent } from "react";

import { readUiLocale } from "~/i18n";
import { cn } from "~/lib/utils";
import { readLocalApi } from "~/localApi";
import type { SidebarProjectSnapshot } from "~/sidebarProjectGrouping";
import { ProjectFavicon } from "../ProjectFavicon";
import { filterSidebarV2VisibleThreads } from "../Sidebar.logic";
import { SharedTooltipTrigger } from "../ui/shared-tooltip";

interface ProjectRailCounts {
  readonly active: number;
  readonly working: number;
}

function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export interface SidebarProjectRailProps {
  readonly projects: readonly SidebarProjectSnapshot[];
  readonly threads: readonly EnvironmentThreadShell[];
  readonly delegatedUnderParent: ReadonlySet<string>;
  readonly serverConfigs: ReadonlyMap<EnvironmentId, EnvironmentServerConfig>;
  readonly selectedProjectKeys: readonly string[];
  readonly onSelectAll: () => void;
  readonly onSelectProject: (projectKey: string, additive: boolean) => void;
  readonly onStartThreadInProject: (project: SidebarProjectSnapshot) => void;
  readonly onOpenProjectSettings: (project: SidebarProjectSnapshot) => void;
  readonly onAddProject: () => void;
  readonly canPinProject: (project: SidebarProjectSnapshot) => boolean;
  readonly onTogglePinProject: (project: SidebarProjectSnapshot) => void;
}

export const SidebarProjectRail = memo(function SidebarProjectRail({
  projects,
  threads,
  delegatedUnderParent,
  serverConfigs,
  selectedProjectKeys,
  onSelectAll,
  onSelectProject,
  onStartThreadInProject,
  onOpenProjectSettings,
  onAddProject,
  canPinProject,
  onTogglePinProject,
}: SidebarProjectRailProps) {
  const isZh = readUiLocale().toLowerCase().startsWith("zh");
  const allLabel = isZh ? "全部" : "All";
  const allTooltip = isZh ? "全部会话" : "All threads";
  const addLabel = isZh ? "添加" : "Add";
  const addTooltip = isZh ? "添加项目文件夹" : "Add project";

  // Count non-settled visible threads once across all projects for crisp Telegram-style folder badges.
  const visibleThreads = filterSidebarV2VisibleThreads(threads, null, delegatedUnderParent);
  const countsByMemberRef = new Map<string, { active: number; working: number }>();
  let totalActive = 0;
  let totalWorking = 0;

  for (const thread of visibleThreads) {
    const configLoaded = serverConfigs.has(thread.environmentId);
    if (configLoaded && thread.settledOverride === "settled") {
      continue;
    }
    const working = isThreadWorking(thread);
    totalActive += 1;
    if (working) totalWorking += 1;

    const refKey = `${thread.environmentId}:${thread.projectId}`;
    const prev = countsByMemberRef.get(refKey);
    if (prev) {
      prev.active += 1;
      if (working) prev.working += 1;
    } else {
      countsByMemberRef.set(refKey, { active: 1, working: working ? 1 : 0 });
    }
  }

  const getProjectCounts = (project: SidebarProjectSnapshot): ProjectRailCounts => {
    let active = 0;
    let working = 0;
    for (const ref of project.memberProjectRefs) {
      const entry = countsByMemberRef.get(`${ref.environmentId}:${ref.projectId}`);
      if (entry) {
        active += entry.active;
        working += entry.working;
      }
    }
    return { active, working };
  };

  const isAllSelected = selectedProjectKeys.length === 0;

  const handleProjectContextMenu = async (
    event: ReactMouseEvent<HTMLButtonElement>,
    project: SidebarProjectSnapshot,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const api = readLocalApi();
    if (!api) return;
    const items: ContextMenuItem[] = [
      {
        id: "new-thread",
        label: isZh ? "在此项目新建会话" : "New thread in project",
      },
      ...(canPinProject(project)
        ? [
            {
              id: "toggle-pin",
              label: project.pinned
                ? isZh
                  ? "取消置顶项目"
                  : "Unpin project"
                : isZh
                  ? "置顶项目"
                  : "Pin project",
            } satisfies ContextMenuItem,
          ]
        : []),
      {
        id: "project-settings",
        label: isZh ? "项目设置…" : "Project settings…",
      },
    ];
    const picked = await api.contextMenu.show(items, {
      x: event.clientX,
      y: event.clientY,
    });
    if (picked === "new-thread") {
      onStartThreadInProject(project);
    } else if (picked === "toggle-pin") {
      onTogglePinProject(project);
    } else if (picked === "project-settings") {
      onOpenProjectSettings(project);
    }
  };

  return (
    <nav
      aria-label={isZh ? "项目分组栏" : "Project folders"}
      data-sidebar-project-rail=""
      className="flex h-full w-[62px] shrink-0 select-none flex-col border-r border-sidebar-border/65 bg-sidebar/55"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-x-hidden overflow-y-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* All Threads tab */}
        <SharedTooltipTrigger
          side="right"
          label={
            totalActive > 0
              ? `${allTooltip} (${totalActive})`
              : allTooltip
          }
          render={
            <button
              type="button"
              aria-pressed={isAllSelected}
              onClick={onSelectAll}
              className={cn(
                "group relative flex w-full cursor-pointer flex-col items-center gap-1 px-1 py-1.5 text-center outline-hidden transition-[transform,color] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isAllSelected
                  ? "text-sidebar-foreground"
                  : "text-sidebar-muted-foreground hover:text-sidebar-foreground",
              )}
            />
          }
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 left-0 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-[height,opacity] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
              isAllSelected ? "h-6 opacity-100" : "h-2 opacity-0",
            )}
          />
          <span
            className={cn(
              "relative flex size-[34px] items-center justify-center rounded-[10px] transition-colors duration-150",
              isAllSelected
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "bg-sidebar-control-surface/55 text-sidebar-icon group-hover:bg-sidebar-row-hover group-hover:text-sidebar-foreground",
            )}
          >
            <LayersIcon className="size-[18px]" aria-hidden />
            {totalActive > 0 ? (
              <span
                className={cn(
                  "pointer-events-none absolute -top-1 -right-1.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[9.5px] leading-none font-semibold tabular-nums ring-2 ring-sidebar",
                  totalWorking > 0
                    ? "bg-primary text-primary-foreground"
                    : isAllSelected
                      ? "bg-foreground/85 text-background"
                      : "bg-sidebar-foreground/18 text-sidebar-foreground",
                )}
              >
                {formatBadgeCount(totalActive)}
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              "max-w-[54px] truncate text-[10px] leading-[1.2] tracking-[0.01em]",
              isAllSelected ? "font-semibold text-sidebar-foreground" : "font-medium",
            )}
          >
            {allLabel}
          </span>
        </SharedTooltipTrigger>

        <div
          aria-hidden
          className="my-1 h-px w-8 shrink-0 rounded-full bg-sidebar-border/60"
        />

        {/* Per-project folder tabs */}
        {projects.map((project) => {
          const isSelected = selectedProjectKeys.includes(project.projectKey);
          const { active, working } = getProjectCounts(project);
          const tooltipDetail =
            active > 0
              ? `${project.displayName} (${active})`
              : project.displayName;

          return (
            <SharedTooltipTrigger
              key={project.projectKey}
              side="right"
              label={tooltipDetail}
              render={
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={(event) => {
                    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
                    if (!additive && isSelected && selectedProjectKeys.length === 1) {
                      onSelectAll();
                      return;
                    }
                    onSelectProject(project.projectKey, additive);
                  }}
                  onContextMenu={(event) => void handleProjectContextMenu(event, project)}
                  className={cn(
                    "group relative flex w-full cursor-pointer flex-col items-center gap-1 px-1 py-1.5 text-center outline-hidden transition-[transform,color] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    isSelected
                      ? "text-sidebar-foreground"
                      : "text-sidebar-muted-foreground hover:text-sidebar-foreground",
                  )}
                />
              }
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 left-0 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-[height,opacity] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                  isSelected ? "h-6 opacity-100" : "h-2 opacity-0",
                )}
              />
              <span
                className={cn(
                  "relative flex size-[34px] items-center justify-center rounded-[10px] transition-colors duration-150",
                  isSelected
                    ? "bg-primary/15 text-sidebar-foreground ring-1 ring-primary/35"
                    : "bg-sidebar-control-surface/55 group-hover:bg-sidebar-row-hover",
                )}
              >
                <ProjectFavicon project={project} className="size-[18px]" />
                {project.pinned ? (
                  <PinIcon
                    aria-hidden
                    className="pointer-events-none absolute -bottom-0.5 -left-0.5 size-2.5 rotate-45 text-sidebar-muted-foreground/80"
                  />
                ) : null}
                {active > 0 ? (
                  <span
                    className={cn(
                      "pointer-events-none absolute -top-1 -right-1.5 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[9.5px] leading-none font-semibold tabular-nums ring-2 ring-sidebar",
                      working > 0
                        ? "bg-primary text-primary-foreground"
                        : isSelected
                          ? "bg-foreground/85 text-background"
                          : "bg-sidebar-foreground/18 text-sidebar-foreground",
                    )}
                  >
                    {formatBadgeCount(active)}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "max-w-[54px] truncate text-[10px] leading-[1.2] tracking-[0.01em]",
                  isSelected ? "font-semibold text-sidebar-foreground" : "font-medium",
                )}
              >
                {project.displayName}
              </span>
            </SharedTooltipTrigger>
          );
        })}
      </div>

      {/* Bottom Add Project action (mirrors Telegram's bottom folder action) */}
      <div className="flex shrink-0 flex-col items-center border-t border-sidebar-border/55 py-1.5">
        <SharedTooltipTrigger
          side="right"
          label={addTooltip}
          render={
            <button
              type="button"
              onClick={onAddProject}
              className="group flex w-full cursor-pointer flex-col items-center gap-0.5 px-1 py-1 text-sidebar-muted-foreground outline-hidden transition-[transform,color] duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-sidebar-foreground active:scale-[0.96] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            />
          }
        >
          <span className="flex size-7 items-center justify-center rounded-lg transition-colors duration-150 group-hover:bg-sidebar-row-hover">
            <FolderPlusIcon className="size-4" aria-hidden />
          </span>
          <span className="max-w-[54px] truncate text-[9.5px] leading-tight font-medium">
            {addLabel}
          </span>
        </SharedTooltipTrigger>
      </div>
    </nav>
  );
});
