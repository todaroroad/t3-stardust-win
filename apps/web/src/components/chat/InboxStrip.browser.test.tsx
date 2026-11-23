import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import "~/index.css";
import { act, fakeTimers, render } from "../../../test/render";
import { InboxStrip } from "./InboxStrip";
import { useResumeCardStore } from "../../resumeCardStore";
import { useTaskBoard } from "../../taskBoard";
import { inboxStripCopy } from "../../inboxStrip";
import { RunId } from "@t3tools/contracts";
import { makeThreadFixture } from "../../test-fixtures";
import { threadResumeToken } from "../../resumeCard";

const toast = vi.hoisted(() => ({ add: vi.fn(() => "toast"), close: vi.fn() }));
const shell = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("../ui/toast", () => ({ toastManager: toast }));
vi.mock("../../useWallArtifacts", () => ({ useWallArtifacts: () => ({ artifacts: [] }) }));
vi.mock("../../state/entities", async (original) => ({
  ...(await original<typeof import("../../state/entities")>()),
  useQuietThreadShell: () => shell.value as never,
  useQuietThreadProjection: () => null,
}));
const ref = scopeThreadRef(EnvironmentId.make("strip-test"), ThreadId.make("strip-test"));
const key = scopedThreadKey(ref);
function setup(reason: string) {
  const previous = useResumeCardStore.getState();
  const previousTasks = useTaskBoard.getState();
  vi.clearAllMocks();
  useResumeCardStore.setState({ selected: {}, hidden: {}, hiddenUntil: {} });
  useTaskBoard.setState({ data: null, error: null });
  useResumeCardStore.getState().open({ key, token: "one", ref, title: "Ready", reason });
  return {
    [Symbol.dispose]() {
      useResumeCardStore.setState(previous, true);
      useTaskBoard.setState(previousTasks, true);
    },
  };
}
it.each([
  { kind: "check", reason: "待验收" },
  { kind: "block", reason: "需要你扫码" },
] as const)(
  "shows the $kind action and only hints for nonempty input",
  async ({ kind, reason }) => {
    using _state = setup(reason);
    const resume = vi.fn(async () => {});
    await using screen = await render(
      <InboxStrip threadRef={ref} prompt="  " disabled={false} onContinue={resume} />,
    );
    const copy = inboxStripCopy[kind];
    await expect
      .element(screen.getByRole("button", { name: copy.primary, exact: true }))
      .toBeVisible();
    expect(screen.container.querySelector(".inbox-strip-hint")).toBeNull();
    await screen.rerender(
      <InboxStrip threadRef={ref} prompt="Change this" disabled={false} onContinue={resume} />,
    );
    await expect.element(screen.getByText(copy.hint)).toBeVisible();
    const strip = screen.container.querySelector<HTMLElement>(".inbox-strip-wrap")!;
    expect(strip.scrollWidth).toBeLessThanOrEqual(strip.clientWidth);
    using _timers = fakeTimers();
    await act(() =>
      (
        screen.getByRole("button", { name: copy.primary, exact: true }).element() as HTMLElement
      ).click(),
    );
    expect(useResumeCardStore.getState().hidden[key]).toBe("one");
    expect(strip.inert).toBe(true);
    expect(resume).not.toHaveBeenCalled();
    const undo = (toast.add.mock.calls[0] as unknown as [{ actionProps: { onClick(): void } }])[0]
      .actionProps.onClick;
    await act(undo);
    await act(() => vi.advanceTimersByTime(3100));
    expect(useResumeCardStore.getState().selected[key]?.token).toBe("one");
    expect(resume).not.toHaveBeenCalled();
  },
);
it("opens reminder choices above the strip and closes without continuing", async () => {
  using _state = setup("需要你扫码");
  using _now = vi.spyOn(Date, "now").mockReturnValue(1794820000000);
  const resume = vi.fn(async () => {});
  await using screen = await render(
    <div style={{ marginTop: 300 }}>
      <InboxStrip threadRef={ref} prompt="" disabled={false} onContinue={resume} />
    </div>,
  );
  const trigger = screen.getByRole("button", { name: "Remind me later or dismiss" });
  await trigger.click();
  const item = page.getByRole("menuitem", { name: "Remind me in one hour" });
  await expect.element(item).toBeVisible();
  const menu = page.getByRole("menu").element();
  expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    trigger.element().getBoundingClientRect().top + 1,
  );
  await item.click();
  expect(useResumeCardStore.getState().hiddenUntil[key]).toBeGreaterThan(1794820000000 + 3590000);
  expect(resume).not.toHaveBeenCalled();
});
it("removes immediately with reduced motion and never grants permission from the strip", async () => {
  const real = window.matchMedia.bind(window);
  using _reduced = vi
    .spyOn(window, "matchMedia")
    .mockImplementation((query) =>
      real(query === "(prefers-reduced-motion: reduce)" ? "all" : query),
    );
  using _state = setup("待授权");
  const resume = vi.fn(async () => {});
  await using screen = await render(
    <InboxStrip threadRef={ref} prompt="" disabled={false} onContinue={resume} />,
  );
  await expect.element(screen.getByRole("button", { name: "Done, continue" })).toBeDisabled();
  await screen.getByRole("button", { name: "Dismiss from Needs you", exact: true }).click();
  expect(screen.container.querySelector("[data-inbox-strip]")).toBeNull();
  expect(resume).not.toHaveBeenCalled();
});
it("V14: never repeats a new result above the composer; the sidebar carries it", async () => {
  using _state = setup("有新结果");
  const finished = {
    ...makeThreadFixture({ id: ref.threadId }),
    latestRun: {
      runId: RunId.make("strip-run"),
      status: "completed" as const,
      requestedAt: null,
      startedAt: null,
      completedAt: "2026-11-02T00:00:00.000Z",
      assistantMessageId: null,
    },
  };
  useResumeCardStore.getState().open({
    key,
    token: threadResumeToken(finished, "有新结果"),
    ref,
    title: "Ready",
    reason: "有新结果",
  });
  try {
    shell.value = finished;
    await using screen = await render(
      <InboxStrip threadRef={ref} prompt="" disabled={false} onContinue={async () => {}} />,
    );
    expect(screen.container.querySelector(".inbox-strip-wrap")).toBeNull();
    // The request itself stays registered for the sidebar's "Needs my attention" list.
    expect(useResumeCardStore.getState().selected[key]?.reason).toBe("有新结果");
  } finally {
    shell.value = null;
  }
});
