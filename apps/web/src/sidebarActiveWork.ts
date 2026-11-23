import { uiText } from "./i18n";
import { backgroundWorkHoldsCompletion } from "@t3tools/shared/orchestrationV2PendingBackgroundWork";
import type { SidebarThreadSummary } from "./types";
import { buildSubtaskTree, subtaskThreadKey } from "./sidebarSubtasks";

export function activeWorkStatus(thread: SidebarThreadSummary): string | null {
  if (thread.deletedAt) return null;
  if (thread.hasPendingApprovals || thread.pendingSubagentRequest === "approval") return "待授权";
  if (thread.hasPendingUserInput || thread.pendingSubagentRequest === "user_input") return "待回答";
  const status = thread.runtime?.status;
  if (status === "preparing" || status === "starting") return uiText("Starting.");
  if (status === "queued") return uiText("Queued.");
  if (status === "running")
    return thread.blockedOnThreadWait ? uiText("Waiting for task") : uiText("Working.");
  if (status === "waiting") return uiText("Waiting for task");
  if (backgroundWorkHoldsCompletion(thread.pendingBackgroundTasks ?? []))
    return uiText("Waiting for background tasks");
  return null;
}

export function collectActiveWork(threads: readonly SidebarThreadSummary[]) {
  const tree = buildSubtaskTree(threads);
  const groups = new Map<
    string,
    { root: SidebarThreadSummary; children: SidebarThreadSummary[] }
  >();
  for (const thread of threads) {
    if (activeWorkStatus(thread) === null) continue;
    const root = tree.rootFor(thread);
    const key = subtaskThreadKey(root);
    let group = groups.get(key);
    if (!group) {
      group = { root, children: [] };
      groups.set(key, group);
    }
    if (subtaskThreadKey(thread) !== key) group.children.push(thread);
  }
  // Creation order stays stable when streaming updates change updatedAt.
  const order = (a: SidebarThreadSummary, b: SidebarThreadSummary) =>
    a.createdAt.localeCompare(b.createdAt) ||
    subtaskThreadKey(a).localeCompare(subtaskThreadKey(b));
  return [...groups.values()]
    .sort((a, b) => order(a.root, b.root))
    .map((group) => ({ ...group, children: group.children.sort(order) }));
}

export function activeWorkPreview(groups: ReturnType<typeof collectActiveWork>) {
  let childSlots = 5 - Math.min(3, groups.length);
  return groups.slice(0, 3).map((group) => {
    const children = group.children.slice(0, Math.min(2, childSlots));
    childSlots -= children.length;
    return { ...group, children };
  });
}

/** "已运行 X 分" from the run's start, at minute precision. */
export function activeWorkElapsed(startedAt: string, nowMs: number) {
  const minutes = Math.floor((nowMs - Date.parse(startedAt)) / 60_000);
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 1) return uiText("Just started");
  if (minutes < 60) return uiText("Running for {minutes}m", { minutes });
  const hours = Math.floor(minutes / 60);
  return uiText("Running for {hours}h{minutes}", {
    hours,
    minutes: minutes % 60 ? uiText(" {count}m", { count: minutes % 60 }) : "",
  });
}
