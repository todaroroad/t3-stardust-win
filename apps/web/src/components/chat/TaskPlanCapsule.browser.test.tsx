import "~/index.css";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { act, fakeTimers, render } from "../../../test/render";
import type { TaskProgressSnapshot } from "../../taskProgress";
import { ComposerFloatAnchor } from "./ComposerBannerStack";
import { TaskPlanCapsule } from "./TaskPlanCapsule";
import { TaskPlanSummary } from "./TaskPlanSummary";
import type { TrailActivity, TrailDetails } from "./taskTrailModel";

function plan(
  total: number,
  completed: number,
  state: TaskProgressSnapshot["state"] = "running",
): TaskProgressSnapshot {
  return {
    planId: "plan",
    steps: Array.from({ length: total }, (_, index) => ({
      id: `s${index}`,
      text: `Step ${index + 1}`,
      status: index < completed ? "completed" : index === completed ? "running" : "pending",
      ...(index < completed ? { durationMs: 60_000 } : {}),
    })),
    completed,
    total,
    remaining: total - completed,
    state,
    stale: false,
  };
}
const command = (id: string, line: string, status: TrailActivity["status"]): TrailActivity => ({
  id,
  kind: "command",
  label: line,
  command: line,
  status: status ?? "completed",
});
const details = (activities: TrailDetails["activities"], durationMs?: number): TrailDetails => ({
  activities,
  choices: [],
  ...(durationMs === undefined ? {} : { durationMs }),
});
const bar = (container: HTMLElement) => container.querySelector<HTMLButtonElement>(".plan-bar")!;

it("collapses a long plan to one row and at most six stages, with operations out of sight", async () => {
  await using screen = await render(
    <TaskPlanCapsule
      progress={plan(14, 4)}
      details={details({
        s4: [command("a", "pnpm test", "failed"), command("b", "pnpm test", "completed")],
      })}
    />,
  );
  expect(bar(screen.container).getBoundingClientRect().height).toBe(40);
  expect(screen.container.querySelector(".plan-card")!.getBoundingClientRect().height).toBe(40);
  const stages = screen.container.querySelectorAll(".plan-stage");
  expect(stages.length).toBeGreaterThanOrEqual(3);
  expect(stages.length).toBeLessThanOrEqual(6);
  expect(screen.container.querySelectorAll(".task-command-row")).toHaveLength(0);
  expect(screen.container.querySelector(".plan-pill")).toBeNull();
  expect(screen.container.querySelector(".plan-count")?.textContent).toMatch(/^\d\/\d$/);
  expect(screen.container.querySelector(".plan-panel-body")?.hasAttribute("inert")).toBe(true);
});

it("opens a bounded panel, shows a one-line summary per stage and details only on a click", async () => {
  const open = vi.fn();
  await using screen = await render(
    <TaskPlanCapsule
      progress={plan(4, 1)}
      onOpenFile={open}
      details={details({
        s1: [
          { id: "r", kind: "read", label: "Read", path: "notes.md", status: "failed" },
          command("a", "pnpm build", "failed"),
          command("b", "pnpm build", "completed"),
          { id: "w", kind: "write", label: "Write", path: "out.md", status: "completed" },
        ],
      })}
    />,
  );
  await act(() => bar(screen.container).click());
  expect(bar(screen.container).getAttribute("aria-expanded")).toBe("true");
  await expect.element(screen.getByText("Task plan", { exact: true })).toBeVisible();
  const body = screen.container.querySelector<HTMLElement>(".plan-panel-body")!;
  await expect.poll(() => body.getBoundingClientRect().height).toBeGreaterThan(100);
  expect(body.getBoundingClientRect().height).toBeLessThanOrEqual(480);
  const summary = screen.container.querySelector(
    '[data-stage-id="milestone-1"] .plan-stage-summary',
  );
  expect(summary?.textContent).toBe("In progress · 4 operations · 1 retry");
  expect(screen.container.querySelectorAll(".task-command-row")).toHaveLength(0);
  await act(() =>
    screen.container
      .querySelector<HTMLButtonElement>('[data-stage-id="milestone-1"] button')!
      .click(),
  );
  await expect.poll(() => screen.container.querySelectorAll(".task-command-row").length).toBe(4);
  await screen.getByRole("button", { name: "out.md" }).click();
  expect(open).toHaveBeenCalledWith("out.md");
  expect(
    screen.container.querySelector('[data-activity-id="r"]')?.getAttribute("data-failure"),
  ).toBe("no-result");
  expect(screen.container.querySelector(".plan-pill")).toBeNull();
});

it("folds on Esc keeping focus, folds on a press outside, and never loops an animation", async () => {
  await using screen = await render(<TaskPlanCapsule progress={plan(4, 1)} />);
  await userEvent.tab();
  expect(document.activeElement).toBe(bar(screen.container));
  const ring = getComputedStyle(bar(screen.container));
  expect([ring.outlineStyle, ring.outlineWidth]).toEqual(["solid", "2px"]);
  await userEvent.keyboard("{Enter}");
  expect(bar(screen.container).getAttribute("aria-expanded")).toBe("true");
  const looping = document
    .getAnimations()
    .filter(
      (animation) => animation.effect?.getComputedTiming().iterations === Number.POSITIVE_INFINITY,
    );
  expect(looping).toHaveLength(0);
  await userEvent.keyboard("{Escape}");
  expect(bar(screen.container).getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(bar(screen.container));
  await act(() => bar(screen.container).click());
  expect(bar(screen.container).getAttribute("aria-expanded")).toBe("true");
  await act(() => {
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  expect(bar(screen.container).getAttribute("aria-expanded")).toBe("false");
});

it("marks a wait before a problem, opens for a wait, and keeps probes out of the problem count", async () => {
  const probes = details({
    s1: [
      { id: "p", kind: "read", label: "Read", path: "a.ts", status: "failed" },
      command("e", "env | grep TOKEN", "failed"),
    ],
  });
  await using screen = await render(<TaskPlanCapsule progress={plan(4, 1)} details={probes} />);
  expect(screen.container.querySelector(".plan-pill")).toBeNull();
  await screen.rerender(
    <TaskPlanCapsule
      progress={plan(4, 1)}
      details={details({ s1: [command("x", "pnpm build", "failed")] })}
    />,
  );
  expect(screen.container.querySelector(".plan-pill")?.textContent).toBe("Problem");
  expect(screen.container.querySelector(".plan-capsule")?.getAttribute("data-mode")).toBe(
    "problem",
  );
  await screen.rerender(
    <TaskPlanCapsule
      progress={plan(4, 1, "input")}
      details={details({ s1: [command("x", "pnpm build", "failed")] })}
      decision={<div className="combo-decision">pick one</div>}
    />,
  );
  expect(screen.container.querySelector(".plan-pill")?.textContent).toBe("Needs confirmation");
  expect(screen.container.querySelector(".plan-capsule")?.getAttribute("data-mode")).toBe("need");
  expect(bar(screen.container).getAttribute("aria-expanded")).toBe("true");
  await expect.element(screen.getByText("pick one")).toBeVisible();
});

it("shows the finished plan, holds while open, then fades once and hands over to the history row", async () => {
  const dismissed = vi.fn();
  await using screen = await render(
    <TaskPlanCapsule progress={plan(4, 2)} onDismissed={dismissed} />,
  );
  using _timers = fakeTimers();
  await screen.rerender(
    <TaskPlanCapsule
      progress={plan(4, 4, "complete")}
      details={details({}, 240_000)}
      onDismissed={dismissed}
    />,
  );
  expect(screen.container.querySelector(".plan-title-in")?.textContent).toBe(
    "Completed · 4 stages · Took 4m 00s",
  );
  expect(screen.container.querySelector(".plan-count")?.textContent).toBe("4/4");
  await act(() => vi.advanceTimersByTimeAsync(4999));
  expect(dismissed).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.container.querySelector(".plan-capsule")?.getAttribute("data-visible")).toBe(
    "false",
  );
  await act(() => vi.advanceTimersByTimeAsync(200));
  expect(dismissed).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(20_000));
  expect(dismissed).toHaveBeenCalledTimes(1);
});

it("does not fade a finished plan the user is looking at, and skips one that was already finished", async () => {
  const dismissed = vi.fn();
  await using held = await render(
    <TaskPlanCapsule progress={plan(4, 3)} onDismissed={dismissed} />,
  );
  using _timers = fakeTimers();
  await held.rerender(
    <TaskPlanCapsule progress={plan(4, 4, "complete")} onDismissed={dismissed} />,
  );
  await act(() => bar(held.container).click());
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(dismissed).not.toHaveBeenCalled();
  const early = vi.fn();
  await using already = await render(
    <TaskPlanCapsule progress={plan(4, 4, "complete")} onDismissed={early} />,
  );
  expect(early).toHaveBeenCalledTimes(1);
  expect(already.container.querySelector(".plan-capsule")).not.toBeNull();
});

it("leaves a history row that reopens the stages", async () => {
  await using screen = await render(
    <TaskPlanSummary progress={plan(4, 4, "complete")} details={details({}, 240_000)} />,
  );
  const row = screen.container.querySelector<HTMLButtonElement>(".plan-summary-bar")!;
  expect(row.textContent).toBe("Completed · 4 stages · Took 4m 00s");
  expect(row.getBoundingClientRect().height).toBe(40);
  await act(() => row.click());
  await expect.poll(() => screen.container.querySelectorAll(".plan-stage").length).toBe(4);
  await expect.element(screen.getByText("Step 1", { exact: true })).toBeVisible();
});

it("hangs above the composer: still while the chat scrolls, lifted by a taller composer, never covering it", async () => {
  await using screen = await render(
    <div style={{ display: "flex", flexDirection: "column", height: 640, width: 760 }}>
      <div data-testid="chat" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <div style={{ height: 3000 }}>conversation</div>
      </div>
      <form data-testid="composer" data-chat-composer-form="true">
        <ComposerFloatAnchor>
          <TaskPlanCapsule progress={plan(4, 1)} />
        </ComposerFloatAnchor>
        <textarea data-testid="editor" style={{ display: "block", width: "100%", height: 80 }} />
      </form>
    </div>,
  );
  const chat = screen.getByTestId("chat").element() as HTMLElement;
  const form = screen.getByTestId("composer").element() as HTMLElement;
  const editor = screen.getByTestId("editor").element() as HTMLElement;
  const card = () => screen.container.querySelector(".plan-card")!.getBoundingClientRect();
  const gap = () => form.getBoundingClientRect().top - card().bottom;
  await expect.poll(gap).toBe(8);
  const before = card().top;
  chat.scrollTop = 1200;
  await expect.poll(() => chat.scrollTop).toBe(1200);
  expect(card().top).toBe(before);
  editor.style.height = "200px";
  expect(gap()).toBe(8);
  expect(card().bottom).toBeLessThanOrEqual(editor.getBoundingClientRect().top);
  await act(() => bar(screen.container).click());
  await expect
    .poll(
      () =>
        screen.container.querySelector<HTMLElement>(".plan-panel-body")!.getBoundingClientRect()
          .height,
    )
    .toBeGreaterThan(100);
  expect(gap()).toBe(8);
  expect(card().top).toBeGreaterThanOrEqual(chat.getBoundingClientRect().top);
});

it("merges same-kind tool sub-items with ×N chips and renders a single-line live fallback without a plan", async () => {
  await using screen = await render(
    <TaskPlanCapsule
      progress={plan(2, 1)}
      details={details({
        s0: [
          { id: "sr1", kind: "search", label: "rg QuotaTopbar", status: "completed" },
          { id: "sr2", kind: "search", label: "apple.css", status: "completed" },
          { id: "rd1", kind: "read", label: "Read", path: "popover.tsx", status: "completed" },
          { id: "rd2", kind: "read", label: "Read", path: "apple.css", status: "completed" },
          { id: "rd3", kind: "read", label: "Read", path: "input.tsx", status: "completed" },
        ],
      })}
    />,
  );
  await act(() => bar(screen.container).click());
  await act(() =>
    screen.container
      .querySelector<HTMLButtonElement>('[data-stage-id="milestone-0"] button')!
      .click(),
  );
  const tags = [...screen.container.querySelectorAll(".plan-tool-tag")].map((el) => el.textContent);
  expect(tags).toEqual(["Search ×2", "Read ×3"]);

  const fallback: TaskProgressSnapshot = {
    steps: [
      { id: "live-0", text: "Inspect workspace", status: "completed" },
      { id: "live-1", text: "Generating UI", status: "running" },
    ],
    completed: 1,
    total: 2,
    remaining: 1,
    state: "running",
    stale: false,
  };
  await screen.rerender(
    <TaskPlanCapsule
      key="fallback"
      progress={fallback}
      details={details({
        "live-0": [
          { id: "f1", kind: "search", label: "rg a", status: "completed" },
          { id: "f2", kind: "search", label: "rg b", status: "completed" },
        ],
      })}
    />,
  );
  expect(screen.container.querySelector(".plan-capsule")?.hasAttribute("data-fallback")).toBe(true);
  expect(screen.container.querySelector(".plan-segments")).toBeNull();
  expect(screen.container.querySelector(".plan-count")).toBeNull();
  expect(bar(screen.container).textContent).toContain("Generating UI");
  expect(bar(screen.container).textContent).toContain("2 calls completed");
});
