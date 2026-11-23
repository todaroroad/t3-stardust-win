import "~/index.css";
import { expect, it, vi } from "vite-plus/test";
import {
  MessageId,
  NodeId,
  PlanId,
  RunId,
  type OrchestrationV2PlanStep,
  type OrchestrationV2Run,
} from "@t3tools/contracts";
import { render } from "../../../test/render";
import { makeThreadFixture, makeThreadProjectionFixture } from "../../test-fixtures";
import { taskProgressSnapshot } from "../../taskProgress";
import { TaskPlanCapsule } from "./TaskPlanCapsule";

// The plan the Claude adapter projects from TaskCreate("Inspect"), TaskCreate("Implement"),
// TaskCreate("Verify") and TaskUpdate(1, in_progress): see ClaudeAdapterV2.test.ts, "projects
// TaskCreate and TaskUpdate into one plan per turn". Step ids are `task-<id>`.
const STEPS: readonly OrchestrationV2PlanStep[] = [
  { id: "task-1", text: "Inspect", status: "completed" },
  { id: "task-2", text: "Implement", status: "running" },
  { id: "task-3", text: "Verify", status: "pending" },
];

function claudeTaskPlanThread() {
  const base = makeThreadProjectionFixture();
  const run: OrchestrationV2Run = {
    id: RunId.make("run-claude-task-tools"),
    threadId: base.thread.id,
    ordinal: 1,
    providerInstanceId: base.thread.providerInstanceId,
    modelSelection: base.thread.modelSelection,
    providerThreadId: null,
    userMessageId: MessageId.make("user-claude-task-tools"),
    rootNodeId: null,
    activeAttemptId: null,
    status: "running",
    requestedAt: base.updatedAt,
    startedAt: base.updatedAt,
    completedAt: null,
    checkpointId: null,
    contextHandoffId: null,
  };
  const plan = {
    id: PlanId.make("plan-claude-task-tools"),
    threadId: base.thread.id,
    runId: run.id,
    nodeId: NodeId.make("root"),
    kind: "todo_list" as const,
    status: "active" as const,
    steps: STEPS,
  };
  const shell = makeThreadFixture({
    latestRun: {
      runId: run.id,
      status: "running",
      requestedAt: null,
      startedAt: null,
      completedAt: null,
      assistantMessageId: null,
    },
    runtime: null,
  });
  return { projection: { ...base, runs: [run], plans: [plan] }, shell };
}

it("shows the plan a Claude TaskCreate/TaskUpdate sequence produces in the step capsule", async () => {
  const { projection, shell } = claudeTaskPlanThread();
  const progress = taskProgressSnapshot(projection, shell);
  expect(progress).toMatchObject({ total: 3, completed: 1, state: "running" });

  await using screen = await render(<TaskPlanCapsule progress={progress} />);
  const bar = screen.container.querySelector<HTMLButtonElement>(".plan-bar")!;
  expect(bar.textContent).toContain("Implement");
  expect(bar.textContent).toContain("1/3");
  expect(screen.container.querySelectorAll(".plan-segments > i")).toHaveLength(3);
});

it("keeps the capsule's backdrop blur live: no filling animation on a backdrop-root property", async () => {
  const { projection, shell } = claudeTaskPlanThread();
  await using screen = await render(
    <TaskPlanCapsule progress={taskProgressSnapshot(projection, shell)} />,
  );
  const capsule = screen.container.querySelector<HTMLElement>(".plan-capsule")!;
  // A finished animation that still fills (`both`/`forwards`) keeps opacity pinned, which makes the
  // capsule a backdrop root and the card's backdrop-filter blur nothing behind it.
  await vi.waitFor(() => {
    const filling = capsule
      .getAnimations()
      .filter(
        (animation) =>
          !["none", "backwards"].includes(animation.effect?.getComputedTiming().fill ?? "none"),
      );
    expect(filling).toEqual([]);
  });
  expect(getComputedStyle(capsule.querySelector(".plan-card")!).backdropFilter).toContain("blur");
});
