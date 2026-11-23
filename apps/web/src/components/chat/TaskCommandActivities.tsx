import { useUiText } from "../../i18n/useUiText";
import { useId, useState } from "react";
import {
  TerminalIcon,
  FileSearchIcon,
  SearchIcon,
  FilePenIcon,
  ImageIcon,
  GitForkIcon,
  ChevronDownIcon,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipPopup } from "../ui/tooltip";
import type { TrailActivity } from "./taskTrailModel";
import { middleTruncateFilename, visibleActivities } from "./commandPresentation";
import { trailFailureKind } from "./taskTrailFailures";
import "./taskCommandActivities.css";
const icons = {
  command: TerminalIcon,
  read: FileSearchIcon,
  write: FilePenIcon,
  image: ImageIcon,
  search: SearchIcon,
  delegate: GitForkIcon,
};
const activityStatusLabels = {
  failed: "Failed",
  running: "In progress",
  completed: "Command completed",
  stopped: "Stopped",
  waiting: "Waiting",
  no_matches: "No matches",
} satisfies Record<NonNullable<TrailActivity["status"]>, string>;

export function TaskCommandActivities({
  activities,
  onOpenFile,
}: {
  readonly activities: readonly TrailActivity[];
  readonly onOpenFile: ((path: string) => void) | undefined;
}) {
  const uiText = useUiText();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const { visible, hidden } = visibleActivities(activities);
  const commands = activities.filter((a) => a.command !== undefined);
  return (
    <div className="task-command-activities">
      {visible.map((activity) => {
        const Icon = icons[activity.kind];
        const failure = trailFailureKind(activity);
        return (
          <div
            className="task-command-row"
            key={activity.id}
            data-status={activity.status}
            data-failure={failure ?? undefined}
            data-activity-id={activity.id}
          >
            <span className="task-command-icon">
              <Icon size={14} strokeWidth={1.5} />
            </span>
            <span className="task-command-label">{activity.label}</span>
            {activity.path ? (
              <Tooltip>
                <TooltipTrigger
                  render={<button type="button" />}
                  className="task-command-path"
                  onClick={() => onOpenFile?.(activity.path!)}
                >
                  {middleTruncateFilename(activity.path)}
                </TooltipTrigger>
                <TooltipPopup>{activity.path}</TooltipPopup>
              </Tooltip>
            ) : activity.program ? (
              <span className="task-command-path">{activity.program}</span>
            ) : null}
            <span className="task-command-status">
              {activity.status
                ? uiText(
                    activity.status === "failed" && failure === "no-result"
                      ? "No result"
                      : activityStatusLabels[activity.status],
                  )
                : null}
            </span>
          </div>
        );
      })}
      {hidden > 0 ? (
        <p className="task-command-more">
          {uiText(hidden === 1 ? "{count} more activity" : "{count} more activities", {
            count: hidden,
          })}
        </p>
      ) : null}
      {commands.length > 0 ? (
        <>
          <button
            type="button"
            className="task-command-toggle"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronDownIcon size={12} />
            {uiText(commands.length === 1 ? "View {count} command" : "View {count} commands", {
              count: commands.length,
            })}
          </button>
          <div
            id={id}
            className="task-command-raw"
            data-expanded={expanded}
            inert={!expanded}
            aria-hidden={!expanded}
          >
            <div>
              {commands.map((a) => (
                <pre key={a.id}>{a.command}</pre>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
