import { testUiLocale } from "../../../test/uiLocale";
import { ThreadTaskTrail } from "./ThreadTaskTrail";
import { makeThreadProjectionFixture } from "../../test-fixtures";
import { NodeId, PlanId, RunId, TurnItemId } from "@t3tools/contracts";
import "~/index.css";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import {
  EnvironmentId,
  RuntimeRequestId,
  ThreadId,
  type ProviderApprovalDecision,
} from "@t3tools/contracts";
import { act, render } from "../../../test/render";
import { TaskPlanCapsule } from "./TaskPlanCapsule";
import { TaskTrailApproval, ApprovalResult, type TrailApprovalInput } from "./TaskTrailApproval";
import { approvalPresentation } from "../../approvalPresentation";
import { applyThemePalette } from "../../themePalette";
import { ResumeCard } from "./ThreadResumeCard";
import type { PendingApproval } from "../../session-logic";
import type { TaskProgressSnapshot } from "../../taskProgress";

const progress: TaskProgressSnapshot = {
  planId: "plan",
  steps: [
    { id: "read", text: "理解目标与检查工作区", status: "completed" },
    { id: "work", text: "实施修改并验证", status: "running" },
    { id: "deliver", text: "交回结果与验证证据", status: "pending" },
  ],
  total: 3,
  completed: 1,
  remaining: 2,
  state: "running",
  stale: false,
};
function request(id = "cmd", overrides: Partial<PendingApproval> = {}): PendingApproval {
  return {
    requestId: RuntimeRequestId.make(id),
    requestKind: "command",
    createdAt: "2026-01-01T00:00:00Z",
    detail: "ls -la src",
    reason: "确认当前目录结构，继续下一步修改。",
    responseCapability: "live",
    options: [
      { decision: "accept", label: "批准" },
      { decision: "acceptForSession", label: "本会话都允许" },
      { decision: "decline", label: "拒绝" },
    ],
    ...overrides,
  };
}
function trail(input: TrailApprovalInput, result?: ProviderApprovalDecision) {
  const current = input.pending[0];
  return (
    <TaskPlanCapsule
      progress={progress}
      {...(current
        ? {
            approval: {
              requestId: current.requestId,
              summary: approvalPresentation(current).summary,
              card: <TaskTrailApproval input={input} />,
            },
          }
        : {})}
      {...(result ? { approvalResults: { work: <ApprovalResult decision={result} /> } } : {})}
    />
  );
}
function input(pending = [request()]): TrailApprovalInput {
  return {
    pending,
    respondingRequestIds: [],
    disabled: false,
    onRespond: vi.fn(async () => ({ _tag: "Success" })),
  };
}
it("opens for a pending approval, uses only provider options, and advances the queue on server removal", async () => {
  using _locale = testUiLocale("zh-CN");
  const data = input([
    request(),
    request("file", {
      requestKind: "file-change",
      detail: "src/index.ts",
      options: [
        { decision: "accept", label: "仅允许一次" },
        { decision: "decline", label: "拒绝" },
      ],
    }),
  ]);
  await using screen = await render(trail(data));
  await expect.element(screen.getByRole("group", { name: "权限请求" })).toBeVisible();
  expect(screen.container.querySelector(".plan-bar")?.getAttribute("aria-expanded")).toBe("true");
  expect(screen.container.querySelectorAll(".trail-approval-actions button")).toHaveLength(3);
  await expect.element(screen.getByText("还有 1 个")).toBeVisible();
  await screen.getByRole("button", { name: "本会话都允许", exact: true }).click();
  expect(data.onRespond).toHaveBeenCalledWith(RuntimeRequestId.make("cmd"), "acceptForSession");
  expect(screen.container.querySelector(".trail-approval-result")).toBeNull();
  await screen.rerender(trail({ ...data, pending: data.pending.slice(1) }, "acceptForSession"));
  await expect.element(screen.getByText("✓ 已批准（本会话同类不再问）")).toBeVisible();
  expect(screen.container.querySelectorAll(".trail-approval-actions button")).toHaveLength(2);
  await expect.element(screen.getByText("src/index.ts")).toBeVisible();
  await screen.getByRole("button", { name: "拒绝", exact: true }).click();
  expect(data.onRespond).toHaveBeenLastCalledWith(RuntimeRequestId.make("file"), "decline");
  await screen.rerender(trail({ ...data, pending: [] }, "decline"));
  await expect.element(screen.getByText("✕ 已拒绝")).toBeVisible();
  expect(screen.container.querySelector(".trail-approval")).toBeNull();
  await expect.element(screen.getByRole("button", { name: "撤销" })).not.toBeInTheDocument();
});
it("does not infer success, double-submit, or enable held, disconnected and unavailable requests", async () => {
  let finish!: (result: unknown) => void;
  const data = {
    ...input(),
    onRespond: vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  };
  await using screen = await render(<TaskTrailApproval input={data} />);
  const approve = screen.getByRole("button", { name: "批准", exact: true });
  await approve.click();
  await expect.element(approve).toBeDisabled();
  await act(() => finish({ _tag: "Failure" }));
  await expect.element(screen.getByRole("alert")).toBeVisible();
  await expect.element(approve).toBeEnabled();
  expect(data.onRespond).toHaveBeenCalledTimes(1);
  for (const variant of [
    { ...data, heldRequestIds: new Set(["cmd"]) },
    { ...data, disabled: true },
    { ...data, pending: [request("cmd", { responseCapability: "not_resumable" })] },
  ]) {
    await screen.rerender(<TaskTrailApproval input={variant} />);
    await expect.element(approve).toBeDisabled();
  }
});
it("scopes keyboard approval to a focused card or the unique request and never takes typing, modifiers or button Enter", async () => {
  using _locale = testUiLocale("zh-CN");
  const data = input([request(), request("second")]);
  await using screen = await render(
    <>
      <TaskTrailApproval input={data} />
      <input aria-label="composer" />
    </>,
  );
  const press = (target: Element | Window, key: string, extra: KeyboardEventInit = {}) =>
    act(() =>
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra }),
      ),
    );
  await press(window, "Enter");
  expect(data.onRespond).not.toHaveBeenCalled();
  const card = screen.getByRole("group", { name: "权限请求" }).element();
  await press(card, "Enter", { isComposing: true });
  await press(card, "Enter", { metaKey: true });
  await press(card, "Enter", { repeat: true });
  await press(screen.getByRole("button", { name: "拒绝", exact: true }).element(), "Enter");
  expect(data.onRespond).not.toHaveBeenCalled();
  await press(card, "Enter");
  expect(data.onRespond).toHaveBeenLastCalledWith(RuntimeRequestId.make("cmd"), "accept");
  await screen.rerender(
    <TaskTrailApproval input={{ ...data, pending: [request("next"), request("last")] }} />,
  );
  await press(screen.getByRole("group", { name: "权限请求" }).element(), "Escape");
  expect(data.onRespond).toHaveBeenLastCalledWith(RuntimeRequestId.make("next"), "decline");
  await screen.rerender(
    <>
      <TaskTrailApproval input={{ ...data, pending: [request()] }} />
      <input aria-label="composer" />
    </>,
  );
  const count = vi.mocked(data.onRespond).mock.calls.length;
  await press(screen.getByRole("textbox").element(), "Enter");
  expect(data.onRespond).toHaveBeenCalledTimes(count);
  await press(window, "Enter");
  expect(data.onRespond).toHaveBeenCalledTimes(count + 1);
  await screen.unmount();
  await press(window, "Escape");
  expect(data.onRespond).toHaveBeenCalledTimes(count + 1);
});
it("keeps the full detail accessible and respects reduced motion", async () => {
  using _locale = testUiLocale("zh-CN");
  const long = "src/" + "very-long-path/".repeat(80);
  using _media = vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList);
  using animation = vi.spyOn(Element.prototype, "animate");
  await using screen = await render(
    <TaskTrailApproval input={input([request("long", { detail: long })])} />,
  );
  expect(screen.container.querySelector("code")?.textContent).toBe(long);
  await screen.getByRole("button", { name: "展开完整命令或路径" }).click();
  expect(screen.container.querySelector("pre")?.getAttribute("data-expanded")).toBe("true");
  await screen.rerender(<ApprovalResult decision="accept" />);
  expect(animation).not.toHaveBeenCalled();
});
it("approves from the resume card through the approval callback and never sends a continuation", async () => {
  using _locale = testUiLocale("zh-CN");
  const onContinue = vi.fn(async () => {});
  const onApprove = vi.fn(async () => ({ _tag: "Success" }));
  const props = {
    request: {
      key: "resume",
      token: "request",
      ref: { environmentId: EnvironmentId.make("env"), threadId: ThreadId.make("thread") },
      reason: "待授权",
      title: "修改项目",
    },
    progress,
    onContinue,
    onSnooze: async () => {},
    onApprove,
  };
  await using screen = await render(<ResumeCard {...props} approval={request()} />);
  await expect.element(screen.getByText("批准或拒绝该请求")).toBeVisible();
  await expect.element(screen.getByText("ls -la src")).toBeVisible();
  await screen.getByRole("button", { name: "批准", exact: true }).click();
  expect(onApprove).toHaveBeenCalledOnce();
  expect(onContinue).not.toHaveBeenCalled();
  await screen.rerender(
    <ResumeCard
      {...props}
      approval={request("deny-only", { options: [{ decision: "decline", label: "拒绝" }] })}
    />,
  );
  await expect
    .element(screen.getByRole("button", { name: "批准", exact: true }))
    .not.toBeInTheDocument();
});
it("captures command, external file and network approvals in the Apple theme without overflow", async () => {
  const before = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(1000, 760);
  await using _viewport = {
    [Symbol.asyncDispose]: () => page.viewport(before.width, before.height),
  };
  applyThemePalette("apple", "light");
  const fixtures = [
    request(),
    request("file", {
      requestKind: "file-change",
      detail: "/Volumes/项目资源/交付稿/说明.md",
      reason: "需要将交付说明写入工作区以外的指定文件夹。",
    }),
    request("net", {
      detail: "pnpm install --frozen-lockfile",
      reason: "安装锁文件中已确定的依赖，以运行验证。",
    }),
  ];
  await using screen = await render(null);
  for (const approval of fixtures) {
    await screen.rerender(
      <div
        data-testid="approval-fixture"
        style={{
          width: 760,
          maxWidth: "100%",
          padding: 24,
          background: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        <p style={{ marginBottom: 18 }}>Codex · 示例数据 · 苹果主题</p>
        <p style={{ marginBottom: 20 }}>已检查项目结构，下一步需要你的授权。</p>
        {trail(input([approval]))}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--card)",
            color: "var(--muted-foreground)",
          }}
        >
          继续输入要求…
        </div>
      </div>,
    );
    const root = screen.getByTestId("approval-fixture").element() as HTMLElement;
    expect(getComputedStyle(root.querySelector(".trail-approval")!).borderRadius).toBe("14px");
    root.style.width = "320px";
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    root.style.width = "760px";
    if (import.meta.env.VITE_CAPTURE_C66 === "1")
      await page.getByTestId("approval-fixture").screenshot({
        path: `c66-approval-${approval.requestId}.png`,
        animations: "disabled",
      });
  }
  applyThemePalette("standard", "light");
});

it("keeps a server-confirmed result under the original step when the plan advances", async () => {
  using _locale = testUiLocale("zh-CN");
  const base = makeThreadProjectionFixture();
  const runId = RunId.make("run");
  const nodeId = NodeId.make("node");
  const planId = PlanId.make("plan");
  const requestId = RuntimeRequestId.make("cmd");
  const projection = {
    ...base,
    runtimeRequests: [
      {
        id: requestId,
        nodeId,
        providerTurnId: null,
        nativeRequestRef: null,
        kind: "command" as const,
        status: "resolved" as const,
        responseCapability: { type: "not_resumable" as const, reason: "resolved" },
        createdAt: base.updatedAt,
        resolvedAt: base.updatedAt,
        decision: "accept" as const,
      },
    ],
    plans: [
      {
        id: planId,
        threadId: base.thread.id,
        runId,
        nodeId,
        kind: "todo_list" as const,
        status: "active" as const,
        steps: progress.steps,
      },
    ],
    turnItems: [
      {
        id: TurnItemId.make("approval"),
        threadId: base.thread.id,
        runId,
        nodeId,
        providerThreadId: null,
        providerTurnId: null,
        nativeItemRef: null,
        parentItemId: null,
        ordinal: 0,
        status: "completed" as const,
        title: null,
        startedAt: base.updatedAt,
        completedAt: base.updatedAt,
        updatedAt: base.updatedAt,
        type: "approval_request" as const,
        requestId,
        requestKind: "command" as const,
      },
    ],
  };
  const threadRef = { environmentId: EnvironmentId.make("c66-result"), threadId: base.thread.id };
  const data = input();
  await using screen = await render(
    <ThreadTaskTrail threadRef={threadRef} progress={progress} approvals={data} />,
  );
  const next = {
    ...progress,
    steps: progress.steps.map((step) => ({
      ...step,
      status: step.id === "deliver" ? ("running" as const) : ("completed" as const),
    })),
    completed: 2,
    remaining: 1,
  };
  await screen.rerender(
    <ThreadTaskTrail
      threadRef={threadRef}
      progress={next}
      projection={projection}
      approvals={{ ...data, pending: [] }}
    />,
  );
  const result = screen.getByText("✓ 已批准（仅这一次）");
  await expect.element(result).toBeVisible();
  expect(result.element().closest("li")?.textContent).toContain("实施修改并验证");
  expect(result.element().closest("li")?.textContent).not.toContain("交回结果与验证证据");
});
