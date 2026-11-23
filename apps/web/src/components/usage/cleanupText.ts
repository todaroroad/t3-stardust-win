import { uiText } from "~/i18n";

export function cleanupCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    "developer-cache": "Developer cache",
    "browser-cache": "Browser cache",
    "user-cache": "User cache",
    "system-cache": "System cache",
    "rollback-apps": "Rollback versions",
    "cold-backups": "Cold backups",
    "old-builds": "Old candidates",
    "project-artifacts": "Build artifacts",
    installers: "Installers",
    "large-old-files": "Downloads",
    cache: "Cache",
    logs: "Logs",
    backups: "Backup",
    protected: "Protected data",
    "agent-history": "Agent history",
    workspaces: "Workspaces",
    database: "Chat database",
    attachments: "Attachments",
    scratch: "Workspaces",
    trash: "Trash",
  };
  const label = labels[category];
  return label ? uiText(label) : category;
}
