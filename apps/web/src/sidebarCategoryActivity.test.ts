import { expect, it } from "vite-plus/test";
import { ThreadId } from "@t3tools/contracts";
import { makeThreadFixture } from "./test-fixtures";
import { inboxThreadKey } from "./workbenchInbox";
import { sortCategorySections, type CategorySection } from "./sidebarCategoryActivity";
import type { SidebarProjectSnapshot } from "./sidebarProjectGrouping";

it("ranks running, attention and latest activity at both category levels, preserving pins and ties", () => {
  const idle = makeThreadFixture({ id: ThreadId.make("idle"), updatedAt: "2026-11-01T00:00:00Z" });
  const recent = makeThreadFixture({
    id: ThreadId.make("recent"),
    updatedAt: "2026-11-15T00:00:00Z",
  });
  const waiting = { ...idle, id: ThreadId.make("waiting"), hasPendingUserInput: true };
  const running = {
    ...idle,
    id: ThreadId.make("running"),
    runtime: { ...idle.runtime!, status: "running" as const },
  };
  const row = (key: string, thread?: typeof idle) =>
    ({
      projectKey: key,
      providerThreadKeys: new Set(thread ? [inboxThreadKey(thread)] : []),
      pinned: false,
    }) as unknown as SidebarProjectSnapshot;
  const sections: CategorySection[] = [
    { group: "内容与账号", projects: [row("idle", idle), row("recent", recent)] },
    { group: "工具与系统", projects: [row("waiting", waiting), row("running", running)] },
    { group: "待归类", projects: [row("empty-a"), row("empty-b")] },
  ];
  const threads = [idle, recent, waiting, running];
  const result = sortCategorySections(sections, threads, [], {}, {});
  expect(result.map((section) => section.group)).toEqual(["工具与系统", "内容与账号", "待归类"]);
  expect(
    result.flatMap((section) => section.projects.map((project) => project.projectKey)),
  ).toEqual(["running", "waiting", "recent", "idle", "empty-a", "empty-b"]);
  expect(
    sortCategorySections(sections, threads, [{ key: "idle", at: 1 }], {}, {})[0]!.projects[0]!
      .projectKey,
  ).toBe("idle");
  expect(
    sortCategorySections(
      sections.slice(0, 1),
      [idle, recent],
      [],
      {},
      { [inboxThreadKey(idle)]: "2026-11-16T00:00:00Z" },
    )[0]!.projects[0]!.projectKey,
  ).toBe("idle");
});
