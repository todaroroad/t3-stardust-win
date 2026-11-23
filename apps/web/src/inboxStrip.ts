import { uiText } from "./i18n";
import type { ResumeRequest } from "./resumeCard";
import { useResumeCardStore } from "./resumeCardStore";
import { toastManager } from "./components/ui/toast";
export type InboxStripState = "new" | "check" | "block";
export function inboxStripState(reason: string): InboxStripState {
  return reason === "有新结果" ? "new" : reason === "待验收" ? "check" : "block";
}
export const inboxStripCopy = {
  new: {
    title: "New results available",
    primary: "Got it",
    link: "View artifacts",
    placeholder: "Have another idea? Tell me, for example “Make the title shorter”.",
    hint: "Sending will remove this item from Needs you.",
  },
  check: {
    title: "Ready for acceptance",
    primary: "Pass review",
    link: "Open sample",
    placeholder: "Need changes? Tell me, for example “The second paragraph is too formal”.",
    hint: "Sending requests changes and removes this item from Needs you.",
  },
  block: {
    title: "Needs your help",
    primary: "Done, continue",
    link: "What to do",
    placeholder: "Cannot do it? Tell me why and I will try another way.",
    hint: "The task will continue with your message.",
  },
} as const;
export function nextInboxMorning(now: Date): number {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next.getTime();
}
export function dismissInboxRequest(
  request: ResumeRequest,
  until?: number,
  commit?: () => Promise<void>,
) {
  const state = useResumeCardStore.getState();
  if (
    state.hidden[request.key] === request.token &&
    (state.hiddenUntil[request.key] === undefined || state.hiddenUntil[request.key]! > Date.now())
  )
    return;
  useResumeCardStore.getState().hide(request, until);
  let cancelled = false;
  const timer = commit
    ? setTimeout(() => {
        if (cancelled) return;
        void commit().catch((cause) => {
          useResumeCardStore.getState().restore(request);
          toastManager.add({
            type: "error",
            title: uiText("Action not confirmed"),
            description: cause instanceof Error ? cause.message : uiText("Please try again"),
          });
        });
      }, 3000)
    : undefined;
  const id = toastManager.add({
    type: "info",
    title:
      until === undefined ? uiText("Removed from Needs you") : uiText("I will remind you then"),
    description: uiText("The task remains in sidebar history"),
    timeout: 3000,
    actionProps: {
      children: uiText("Undo"),
      onClick: () => {
        cancelled = true;
        if (timer !== undefined) clearTimeout(timer);
        useResumeCardStore.getState().restore(request);
        toastManager.close(id);
      },
    },
  });
}
export function acknowledgeInboxMessage(threadKey: string, text: string) {
  if (!text.trim()) return;
  const request = useResumeCardStore.getState().selected[threadKey];
  if (request) dismissInboxRequest(request);
}
