import { useEffect, useEffectEvent, useState } from "react";
import type { SidebarProjectSnapshot } from "./sidebarProjectGrouping";
import type { SidebarThreadSummary } from "./types";
import type { ThreadCategoryGroup } from "./threadCategories";
import { activeWorkStatus } from "./sidebarActiveWork";
import { attentionReason } from "./sidebarInboxPresentation";
import { inboxThreadKey } from "./workbenchInbox";
import type { PinnedProject } from "./sidebarProjectFirst";

export interface CategorySection {
  readonly group: ThreadCategoryGroup;
  readonly projects: readonly SidebarProjectSnapshot[];
}
export function sortCategorySections(
  sections: readonly CategorySection[],
  threads: readonly SidebarThreadSummary[],
  pins: readonly PinnedProject[],
  acknowledged: Readonly<Record<string, string>>,
  visits: Readonly<Record<string, string>>,
) {
  const byKey = new Map(threads.map((thread) => [inboxThreadKey(thread), thread]));
  const pinOrder = new Map(pins.map((pin) => [pin.key, pin.at]));
  const score = (project: SidebarProjectSnapshot) => {
    let running = 0,
      attention = 0,
      latest = 0;
    for (const key of project.providerThreadKeys ?? []) {
      const thread = byKey.get(key);
      if (!thread || thread.deletedAt || thread.archivedAt) continue;
      const reason = attentionReason(thread, acknowledged, visits[key]);
      const active = activeWorkStatus(thread);
      running = Math.max(
        running,
        Number(active !== null && active !== "待授权" && active !== "待回答"),
      );
      attention = Math.max(attention, Number(reason !== null));
      for (const timestamp of [thread.updatedAt, thread.latestRun?.completedAt, visits[key]]) {
        const time = Date.parse(timestamp ?? "");
        if (Number.isFinite(time)) latest = Math.max(latest, time);
      }
    }
    return {
      pin: pinOrder.get(project.projectKey) ?? (project.pinned ? 0 : Infinity),
      running,
      attention,
      latest,
    };
  };
  const compare = (a: ReturnType<typeof score>, b: ReturnType<typeof score>) =>
    (a.pin === b.pin ? 0 : a.pin - b.pin) ||
    b.running - a.running ||
    b.attention - a.attention ||
    b.latest - a.latest;
  const scores = new Map(
    sections.flatMap((section) =>
      section.projects.map((project) => [project.projectKey, score(project)] as const),
    ),
  );
  const ranked = sections.map((section) => ({
    ...section,
    projects: section.projects.toSorted((a, b) =>
      compare(scores.get(a.projectKey)!, scores.get(b.projectKey)!),
    ),
  }));
  return ranked.toSorted((a, b) =>
    compare(scores.get(a.projects[0]!.projectKey)!, scores.get(b.projects[0]!.projectKey)!),
  );
}

export function useStableCategoryOrder(sections: readonly CategorySection[] | null) {
  const desired =
    sections?.flatMap((section) => [
      section.group,
      ...section.projects.map((project) => project.projectKey),
    ]) ?? [];
  const [order, setOrder] = useState(desired);
  const [pointer, setPointer] = useState(false);
  const [focus, setFocus] = useState(false);
  const frozen = pointer || focus;
  const changed = desired.join("\n") !== order.join("\n");
  const applyLatest = useEffectEvent(() => setOrder(desired));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Defer external activity reordering while the pointer or focus holds the sidebar, coalescing bursts into one update.
  useEffect(() => {
    if (frozen || !changed) return;
    const timer = window.setTimeout(applyLatest, 1000);
    return () => window.clearTimeout(timer);
  }, [frozen, changed]);
  const rank = new Map(order.map((key, index) => [key, index]));
  const index = (key: string) => rank.get(key) ?? Infinity;
  const attachInteraction = (node: HTMLElement | null) => {
    if (!node) return;
    const root = node.closest('[data-sidebar="sidebar"]') ?? node;
    const enter = () => setPointer(true);
    const leave = () => setPointer(false);
    const focusIn = () => setFocus(true);
    const focusOut = (event: Event) => {
      if (!root.contains((event as FocusEvent).relatedTarget as Node | null)) setFocus(false);
    };
    root.addEventListener("pointerenter", enter);
    root.addEventListener("pointerleave", leave);
    root.addEventListener("focusin", focusIn);
    root.addEventListener("focusout", focusOut);
    return () => {
      root.removeEventListener("pointerenter", enter);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("focusin", focusIn);
      root.removeEventListener("focusout", focusOut);
    };
  };
  return {
    sections:
      sections
        ?.map((section) => ({
          ...section,
          projects: section.projects.toSorted((a, b) => index(a.projectKey) - index(b.projectKey)),
        }))
        .toSorted((a, b) => index(a.group) - index(b.group)) ?? null,
    attachInteraction,
  };
}
