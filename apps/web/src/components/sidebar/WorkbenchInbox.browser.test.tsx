import { testUiLocale } from "../../../test/uiLocale";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { ThreadResumeCard } from "../chat/ThreadResumeCard";
import { useResumeCardStore } from "../../resumeCardStore";
import { useUiStateStore } from "../../uiStateStore";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { applyThemePalette } from "~/themePalette";
import { RunId, ThreadId } from "@t3tools/contracts";
import "~/index.css";
import { act, fakeTimers, render } from "../../../test/render";
import { makeThreadFixture } from "../../test-fixtures";
import type { SidebarThreadSummary } from "../../types";
import { useRightPanelStore } from "../../rightPanelStore";
import type { BoardData } from "../../taskBoard.logic";
import { WorkbenchInbox } from "./WorkbenchInbox";
import { threadResumeToken } from "../../resumeCard";

const board = vi.hoisted(() => ({ data: null as BoardData | null }));

vi.mock("../../taskBoard", () => ({
  useTaskBoard: Object.assign(
    (select: (state: { error: null; data: BoardData | null }) => unknown) =>
      select({ error: null, data: board.data }),
    { setState: () => {} },
  ),
  mutateTaskBoard: async () => {},
  requestTaskBoardCard: () => {},
  focusTaskBoardItem: () => {},
}));
vi.mock("../../state/entities", async (original) => ({
  ...(await original<typeof import("../../state/entities")>()),
  useAllEnvironmentShellsBootstrapped: () => true,
  useQuietThreadProjection: () => null,
  useThreadShell: () => null,
}));
vi.mock("../../state/environments", async (original) => ({
  ...(await original<typeof import("../../state/environments")>()),
  useEnvironments: () => ({
    environments: [{ connection: { phase: "connected" } }],
    isReady: true,
  }),
  useEnvironment: () => null,
}));
vi.mock("../../state/use-atom-command", () => ({
  useAtomCommand: () => async () => ({ _tag: "Success" }),
}));

const finished = (index: number): SidebarThreadSummary => ({
  ...makeThreadFixture({ id: ThreadId.make(`done-${index}`), title: `Done ${index}` }),
  lastVisitedAt: "2026-11-01T00:00:00.000Z",
  latestRun: {
    runId: RunId.make(`run-${index}`),
    status: "completed",
    requestedAt: null,
    startedAt: null,
    completedAt: `2026-11-02T00:0${index}:00.000Z`,
    assistantMessageId: null,
  },
});

describe("sidebar inbox", () => {
  it("lists unread, waiting and failed threads inline, five at a time, and opens them directly", async () => {
    using _locale = testUiLocale("zh-CN");
    const waiting = {
      ...makeThreadFixture({ id: ThreadId.make("ask"), title: "Needs answer" }),
      hasPendingUserInput: true,
    };
    const navigate = vi.fn();
    await using screen = await render(
      <WorkbenchInbox
        threads={[waiting, ...Array.from({ length: 6 }, (_, index) => finished(index))]}
        projects={[]}
        activeKey={null}
        navigate={navigate}
      />,
    );
    const openPanel = vi.spyOn(useRightPanelStore.getState(), "open");
    const list = screen.getByRole("list", { name: "待我处理的会话" });
    // Waiting first, then the oldest unread results; the rest stay behind "更多".
    await expect.element(list.getByRole("button", { name: /Needs answer/ })).toBeVisible();
    await expect.element(list.getByRole("button", { name: /待回答/ })).toBeVisible();
    await expect.element(list.getByRole("button", { name: /Done 3/ })).toBeVisible();
    await expect.element(list.getByRole("button", { name: /Done 4/ })).not.toBeInTheDocument();
    await list.getByRole("button", { name: "更多 2" }).click();
    await list.getByRole("button", { name: /Done 5/ }).click();
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ threadId: "done-5" }));
    // The section title is a label now: it no longer sends the user to the task panel.
    await screen.getByText("待我处理", { exact: true }).click();
    expect(openPanel).not.toHaveBeenCalled();
  });
});

it("removes attention state immediately while an inert row exits, including the last row", async () => {
  using _locale = testUiLocale("zh-CN");
  const waiting = {
    ...makeThreadFixture({ id: ThreadId.make("motion-ask"), title: "Motion answer" }),
    hasPendingUserInput: true,
  };
  const navigate = vi.fn();
  await using screen = await render(
    <WorkbenchInbox threads={[waiting]} projects={[]} activeKey={null} navigate={navigate} />,
  );
  using _timers = fakeTimers();
  const badge = screen.container.querySelector('[aria-label="需要回答 1 条"]')!;
  using bounce = vi.spyOn(badge, "animate");
  await screen.rerender(
    <WorkbenchInbox threads={[]} projects={[]} activeKey={null} navigate={navigate} />,
  );
  const exit = screen.container.querySelector<HTMLElement>(".workbench-inbox-exit")!;
  expect(exit).not.toBeNull();
  expect(exit.inert).toBe(true);
  expect(exit.getAttribute("aria-hidden")).toBe("true");
  expect(screen.container.querySelector('[aria-label="需要回答 0 条"]')).not.toBeNull();
  expect(bounce).toHaveBeenCalledTimes(1);
  await act(() => {
    vi.advanceTimersByTime(350);
  });
  expect(screen.container.querySelector(".workbench-inbox-exit")).toBeNull();
  expect(screen.container.querySelector('[aria-label="待我处理的会话"]')).toBeNull();
});

it("skips inbox exit and count animation when reduced motion is requested", async () => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  using _matches = vi.spyOn(media, "matches", "get").mockReturnValue(true);
  using _media = vi.spyOn(window, "matchMedia").mockReturnValue(media);
  const waiting = {
    ...makeThreadFixture({ id: ThreadId.make("reduced-ask"), title: "Reduced answer" }),
    hasPendingUserInput: true,
  };
  const navigate = vi.fn();
  await using screen = await render(
    <WorkbenchInbox threads={[waiting]} projects={[]} activeKey={null} navigate={navigate} />,
  );
  using animate = vi.spyOn(Element.prototype, "animate");
  await screen.rerender(
    <WorkbenchInbox threads={[]} projects={[]} activeKey={null} navigate={navigate} />,
  );
  expect(screen.container.querySelector(".workbench-inbox-exit")).toBeNull();
  expect(animate).not.toHaveBeenCalled();
});

it("does not exit hidden rows on collapse and restores a returning row before its exit deadline", async () => {
  using _locale = testUiLocale("zh-CN");
  const threads = Array.from({ length: 6 }, (_, index) => finished(index + 1));
  const navigate = vi.fn();
  await using screen = await render(
    <WorkbenchInbox threads={threads} projects={[]} activeKey={null} navigate={navigate} />,
  );
  await screen.getByRole("button", { name: "更多 1" }).click();
  await screen.getByRole("button", { name: "收起", exact: true }).click();
  expect(screen.container.querySelector(".workbench-inbox-exit")).toBeNull();
  using _timers = fakeTimers();
  await screen.rerender(
    <WorkbenchInbox
      threads={threads.slice(1)}
      projects={[]}
      activeKey={null}
      navigate={navigate}
    />,
  );
  expect(screen.container.querySelectorAll(".workbench-inbox-exit")).toHaveLength(1);
  await screen.rerender(
    <WorkbenchInbox threads={threads} projects={[]} activeKey={null} navigate={navigate} />,
  );
  expect(screen.container.querySelector(".workbench-inbox-exit")).toBeNull();
  await act(() => {
    vi.advanceTimersByTime(350);
  });
  expect(screen.container.querySelector('[data-inbox-thread="done-1"]')).not.toBeNull();
});

it("only lists linked board attention and opens its conversation without a task panel", async () => {
  board.data = {
    tasks: Array.from({ length: 6 }, (_, index) => ({
      folder: `/work/task-${index}`,
      title: `Board task ${index}`,
      state: "user" as const,
      notify_key: `task-${index}`,
      snoozed: false,
      stale: false,
      age_days: 1,
      steps: [],
      missing: [],
      next: "Review",
      blocked: "",
      sessions: index === 0 ? ["linked"] : [],
      done_count: 0,
      total: 1,
      judge: "请确认交付",
    })),
    counts: { active: 6, user: 6, blocked: 0, agent: 0, stale: 0, done_week: 0, badge: 6 },
  };
  try {
    useRightPanelStore.setState({ byThreadKey: {} });
    const linked = makeThreadFixture({ id: ThreadId.make("linked"), title: "Linked thread" });
    const navigate = vi.fn();
    await using screen = await render(
      <WorkbenchInbox threads={[linked]} projects={[]} activeKey={null} navigate={navigate} />,
    );
    await expect.element(screen.getByRole("button", { name: /Board task 0/ })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /Board task 5/ }))
      .not.toBeInTheDocument();
    await screen.getByRole("button", { name: /Board task 0/ }).click();
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ threadId: "linked" }));
    expect(useRightPanelStore.getState().byThreadKey).toEqual({});
    await expect
      .element(screen.getByRole("button", { name: /Board task 1/ }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /任务板.*项待处理/ }))
      .not.toBeInTheDocument();
  } finally {
    board.data = null;
  }
});

it("sends the continuation from the selected thread and immediately removes its actionable row", async () => {
  using _locale = testUiLocale("zh-CN");
  useResumeCardStore.setState({ selected: {}, hidden: {}, hiddenUntil: {} });
  const thread = {
    ...makeThreadFixture({ id: ThreadId.make("continue-inbox"), title: "继续扫码任务" }),
    hasPendingUserInput: true,
  };
  const send = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  await using screen = await render(
    <>
      <WorkbenchInbox threads={[thread]} projects={[]} activeKey={null} navigate={() => {}} />
      <ThreadResumeCard
        threadRef={ref}
        progress={null}
        disabled={false}
        onContinue={send}
        onSnooze={undefined}
        onDismiss={undefined}
      />
    </>,
  );
  await screen
    .getByRole("list", { name: "待我处理的会话" })
    .getByRole("button", { name: /继续扫码任务/ })
    .click();
  await screen.getByRole("button", { name: "我处理好了，继续" }).click();
  expect(send).toHaveBeenCalledExactlyOnceWith("已处理好，继续。");
  await expect
    .element(
      screen
        .getByRole("list", { name: "待我处理的会话" })
        .getByRole("button", { name: /继续扫码任务/ }),
    )
    .not.toBeInTheDocument();
});

it("never keeps a finished sub-agent in Needs you, even after its result was opened", async () => {
  const previous = useResumeCardStore.getState();
  useResumeCardStore.setState({ selected: {}, hidden: {}, hiddenUntil: {} });
  try {
    const parent = finished(4);
    const base = finished(5);
    const child: SidebarThreadSummary = {
      ...base,
      title: "Child audit",
      lineage: {
        rootThreadId: parent.id,
        parentThreadId: parent.id,
        relationshipToParent: "subagent",
      },
    };
    const key = scopedThreadKey(scopeThreadRef(child.environmentId, child.id));
    // What opening the child used to record (InboxStrip registers artifacts as a new result).
    useResumeCardStore.getState().open({
      key,
      token: threadResumeToken(child, "有新结果"),
      ref: scopeThreadRef(child.environmentId, child.id),
      title: child.title,
      reason: "有新结果",
    });
    await using screen = await render(
      <WorkbenchInbox
        threads={[{ ...parent, lastVisitedAt: "2026-11-03T00:00:00.000Z" }, child]}
        projects={[]}
        activeKey={null}
        navigate={vi.fn()}
      />,
    );
    expect(screen.container.textContent).not.toMatch(/子任务|Child audit|Done 4/);
  } finally {
    useResumeCardStore.setState(previous, true);
  }
});
it("keeps a result out of Needs you while its background task runs, then lists it once", async () => {
  const previous = useResumeCardStore.getState();
  useResumeCardStore.setState({ selected: {}, hidden: {}, hiddenUntil: {} });
  try {
    const thread = finished(6);
    const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
    // The result strip recorded the finished turn before the delegate finished.
    useResumeCardStore.getState().open({
      key,
      token: threadResumeToken(thread, "有新结果"),
      ref: scopeThreadRef(thread.environmentId, thread.id),
      title: thread.title,
      reason: "有新结果",
    });
    const waiting = {
      ...thread,
      pendingBackgroundTasks: [{ taskId: "delegate", kind: "subagent" as const }],
    };
    await using screen = await render(
      <WorkbenchInbox threads={[waiting]} projects={[]} activeKey={null} navigate={vi.fn()} />,
    );
    // Only the running row mentions it; no new-result card.
    expect(screen.container.textContent).toContain("Waiting for background tasks");
    expect(screen.container.textContent).not.toMatch(/New results?/);
    await screen.rerender(
      <WorkbenchInbox threads={[thread]} projects={[]} activeKey={null} navigate={vi.fn()} />,
    );
    expect(screen.container.textContent?.match(/New results?/g)).toHaveLength(1);
    expect(screen.container.textContent).not.toContain("Waiting for background tasks");
  } finally {
    useResumeCardStore.setState(previous, true);
  }
});
it("keeps an opened new result until explicit dismissal, including a persisted reload", async () => {
  const previous = useResumeCardStore.getState();
  const previousVisits = useUiStateStore.getState().threadLastVisitedAtById;
  useResumeCardStore.setState({ selected: {}, hidden: {}, hiddenUntil: {} });
  try {
    const thread = finished(2);
    const navigate = vi.fn();
    await using screen = await render(
      <WorkbenchInbox threads={[thread]} projects={[]} activeKey={null} navigate={navigate} />,
    );
    await screen.getByRole("button", { name: /Done 2/ }).click();
    const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
    const request = useResumeCardStore.getState().selected[key]!;
    const visited = { ...thread, lastVisitedAt: "2026-11-03T00:00:00.000Z" };
    await screen.rerender(
      <WorkbenchInbox threads={[visited]} projects={[]} activeKey={key} navigate={navigate} />,
    );
    await expect.element(screen.getByRole("button", { name: /Done 2/ })).toBeVisible();
    await act(() => useResumeCardStore.getState().hide(request, 4102444800000));
    await expect.element(screen.getByRole("button", { name: /Done 2/ })).not.toBeInTheDocument();
    const persisted = localStorage.getItem("t3code:resume-attention:v1")!;
    useResumeCardStore.setState({ selected: {}, hidden: {}, hiddenUntil: {} });
    localStorage.setItem("t3code:resume-attention:v1", persisted);
    await act(() => useResumeCardStore.persist.rehydrate());
    expect(useResumeCardStore.getState().selected[key]).toEqual(request);
    await expect.element(screen.getByRole("button", { name: /Done 2/ })).not.toBeInTheDocument();
    await act(() => useResumeCardStore.getState().restore(request));
    await expect.element(screen.getByRole("button", { name: /Done 2/ })).toBeVisible();
    const row = screen.container.querySelector('[data-inbox-thread="done-2"]')!.closest("li")!;
    await userEvent.hover(row);
    await userEvent.click(
      row.querySelector<HTMLButtonElement>('[data-inbox-quick-action="done"]')!,
    );
    await vi.waitFor(() => expect(useResumeCardStore.getState().hidden[key]).toBe(request.token));
    await expect.element(screen.getByRole("button", { name: /Done 2/ })).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledTimes(1);
  } finally {
    useResumeCardStore.setState(previous, true);
    useUiStateStore.setState({ threadLastVisitedAtById: previousVisits });
  }
});

it("V12 shows finish / archive / more on a result row and a handle button on a waiting row", async () => {
  using _locale = testUiLocale("zh-CN");
  applyThemePalette("apple", "light");
  await page.viewport(360, 420);
  const waiting = {
    ...makeThreadFixture({ id: ThreadId.make("ask-quick"), title: "Needs answer" }),
    hasPendingUserInput: true,
  };
  const navigate = vi.fn();
  await using screen = await render(
    <div data-slot="sidebar" style={{ width: 300, padding: 8, background: "var(--sidebar)" }}>
      <WorkbenchInbox
        threads={[waiting, finished(1)]}
        projects={[]}
        activeKey={null}
        navigate={navigate}
      />
    </div>,
  );
  const resultRow = document.querySelector('[data-inbox-thread="done-1"]')!.closest("li")!;
  await userEvent.hover(resultRow);
  const strip = resultRow.querySelector<HTMLElement>("[data-inbox-quick-actions]")!;
  expect(strip.dataset.inboxQuickActions).toBe("finished");
  expect(
    [...strip.querySelectorAll("[data-inbox-quick-action]")].map((n) =>
      n.getAttribute("data-inbox-quick-action"),
    ),
  ).toEqual(["done", "archive", "more"]);
  await vi.waitFor(() => expect(getComputedStyle(strip).opacity).toBe("1"));
  const askRow = document.querySelector('[data-inbox-thread="ask-quick"]')!.closest("li")!;
  await userEvent.hover(askRow);
  const askStrip = askRow.querySelector<HTMLElement>("[data-inbox-quick-actions]")!;
  expect(askStrip.dataset.inboxQuickActions).toBe("needs-you");
  await userEvent.click(
    askStrip.querySelector<HTMLButtonElement>('[data-inbox-quick-action="open"]')!,
  );
  expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ threadId: "ask-quick" }));
});

it("V14 keeps titles clear of the hover actions, lists today's done threads, and offers status changes", async () => {
  using _locale = testUiLocale("zh-CN");
  applyThemePalette("apple", "light");
  await page.viewport(360, 520);
  const doneToday = {
    ...makeThreadFixture({ id: ThreadId.make("settled-today"), title: "Settled today" }),
    settledOverride: "settled" as const,
    settledAt: new Date().toISOString(),
  };
  await using screen = await render(
    <div data-slot="sidebar" style={{ width: 300, padding: 8, background: "var(--sidebar)" }}>
      <WorkbenchInbox
        threads={[finished(2), doneToday]}
        projects={[]}
        activeKey={null}
        navigate={vi.fn()}
      />
    </div>,
  );
  const row = document.querySelector('[data-inbox-thread="done-2"]')!.closest("li")!;
  await userEvent.hover(row);
  const strip = row.querySelector<HTMLElement>("[data-inbox-quick-actions]")!;
  await vi.waitFor(() => expect(getComputedStyle(strip).opacity).toBe("1"));
  const title = row.querySelector<HTMLElement>(".truncate")!;
  // The title ends before the first action button: nothing is drawn over the text.
  expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(
    strip.getBoundingClientRect().left,
  );
  // Done today is collapsed until asked for.
  const doneHeader = screen.getByRole("button", { name: /今天已完成/ });
  await expect.element(doneHeader).toHaveAttribute("aria-expanded", "false");
  expect(document.querySelector('[data-inbox-done-thread="settled-today"]')).toBeNull();
  await doneHeader.click();
  await expect
    .element(screen.getByRole("button", { name: /Settled today/ }))
    .toBeVisible();
  // The status dot opens the state list: done is checked, "in progress" follows the agent.
  await userEvent.click(row.querySelector<HTMLButtonElement>("[data-inbox-status]")!);
  await expect.element(page.getByRole("menuitem", { name: /待我处理/ })).toBeVisible();
  await expect.element(page.getByRole("menuitem", { name: /进行中/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});
