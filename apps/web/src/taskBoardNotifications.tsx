import { uiText } from "./i18n";
import type { AnyRouter } from "@tanstack/react-router";
import type { AtomRegistry } from "effect/reactivity";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { environmentThreadShells } from "./state/threads";
import { getClientSettings } from "./hooks/useSettings";
import { hasDesktopNotifications } from "./threadNotifications";
import { useTaskBoard, startTaskBoardPolling, requestTaskBoardCard } from "./taskBoard";
import {
  canPresentBoardTask,
  readBoardDelivery,
  boardSummaryDay,
  shouldPresentBoardSummary,
} from "./taskBoard.logic";
import { useRightPanelStore } from "./rightPanelStore";
import { TaskBoardSnooze } from "./components/TaskBoardPanel";
import { toastManager } from "./components/ui/toast";
const STORAGE_KEY = "t3code:task-board-notifications:v1";
export function startTaskBoardNotifications(
  registry: AtomRegistry.AtomRegistry,
  router: AnyRouter,
  isBusy: () => boolean,
) {
  const stopPolling = startTaskBoardPolling();
  let stopped = false;
  const cards = new Map<string, ReturnType<typeof toastManager.add>>();
  let desktop: Notification | null = null;
  const tick = async () => {
    if (stopped || !navigator.locks) return;
    await navigator.locks
      .request(STORAGE_KEY, { ifAvailable: true }, (lock) => {
        if (!lock || stopped) return;
        const { data, error } = useTaskBoard.getState();
        if (!data || error) return;
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(STORAGE_KEY);
        } catch {
          return;
        }
        const delivery = readBoardDelivery(saved);
        const now = new Date();
        const settings = getClientSettings();
        const focused = document.activeElement;
        const busy =
          isBusy() ||
          !!focused?.closest("input,textarea,[contenteditable=true]") ||
          document.visibilityState !== "visible";
        for (const [key, id] of cards) {
          if (
            !settings.inAppNotificationsEnabled ||
            !data.tasks.some(
              (t) =>
                t.notify_key === key && !t.snoozed && (t.state === "user" || t.state === "blocked"),
            )
          ) {
            toastManager.close(id);
            cards.delete(key);
          }
        }
        if (settings.inAppNotificationsEnabled) {
          const task = data.tasks.find((t) =>
            canPresentBoardTask(t, now, delivery.seen, delivery.last, busy),
          );
          if (task) {
            const refs = registry.get(environmentThreadShells.threadRefsAtom);
            const path = router.state.location.pathname.split("/").map(decodeURIComponent);
            const ref = refs.find(
              (r) => path.includes(r.threadId) && path.includes(r.environmentId),
            );
            {
              delivery.seen[task.notify_key] = now.getTime();
              delivery.last[task.folder] = now.getTime();
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(delivery));
              } catch {
                return;
              }
              const id = toastManager.add({
                type: "warning",
                title:
                  task.state === "blocked"
                    ? uiText("Task needs unblocking")
                    : uiText("It’s your turn"),
                description: (
                  <span className="block space-y-2">
                    <span className="block">{task.title}</span>
                    <span className="block">{task.blocked || task.next}</span>
                    <TaskBoardSnooze task={task} environmentId={ref?.environmentId} />
                  </span>
                ),
                ...(ref
                  ? {
                      actionProps: {
                        children: uiText("View task"),
                        onClick: () => {
                          requestTaskBoardCard(task.folder);
                          useRightPanelStore
                            .getState()
                            .open(scopeThreadRef(ref.environmentId, ref.threadId), "tasks");
                          toastManager.close(id);
                        },
                      },
                    }
                  : {}),
              });
              cards.set(task.notify_key, id);
            }
          }
        }
        const day = boardSummaryDay(now);
        if (
          shouldPresentBoardSummary(now, delivery.summary) &&
          hasDesktopNotifications(settings.notificationMode) &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            desktop = new Notification(uiText("Today’s tasks"), {
              body: uiText(
                "{user} waiting for you · {blocked} blocked · {stale} idle over 3 days",
                { user: data.counts.user, blocked: data.counts.blocked, stale: data.counts.stale },
              ),
              tag: "t3-task-board-daily",
              silent: true,
            });
            desktop.onclick = () => {
              const path = router.state.location.pathname.split("/").map(decodeURIComponent);
              const ref = registry
                .get(environmentThreadShells.threadRefsAtom)
                .find((r) => path.includes(r.threadId) && path.includes(r.environmentId));
              requestTaskBoardCard();
              if (ref) useRightPanelStore.getState().open(ref, "tasks");
              window.focus();
            };
            delivery.summary = day;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(delivery));
          } catch {
            /* Desktop presentation may be unavailable despite granted permission. */
          }
        }
      })
      .catch(() => undefined);
  };
  const unsubscribe = useTaskBoard.subscribe(() => {
    void tick();
  });
  const timer = setInterval(() => {
    void tick();
  }, 30000);
  const onFocus = () => {
    void tick();
  };
  document.addEventListener("focusout", onFocus);
  document.addEventListener("visibilitychange", onFocus);
  void tick();
  return () => {
    stopped = true;
    stopPolling();
    unsubscribe();
    clearInterval(timer);
    document.removeEventListener("focusout", onFocus);
    document.removeEventListener("visibilitychange", onFocus);
    for (const id of cards.values()) toastManager.close(id);
    desktop?.close();
  };
}
