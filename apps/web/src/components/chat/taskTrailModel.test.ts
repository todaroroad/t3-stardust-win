import { testUiLocale } from "../../../test/uiLocale";
import { expect, it } from "vite-plus/test";
import * as DateTime from "effect/DateTime";
import {
  MessageId,
  NodeId,
  PlanId,
  RunId,
  TurnItemId,
  type OrchestrationV2Run,
  type OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import { makeThreadProjectionFixture } from "../../test-fixtures";
import { liveActivityTrailSnapshot, taskTrailDetails, trailActivity } from "./taskTrailModel";
import type { TaskProgressSnapshot } from "../../taskProgress";

function fixture() {
  const projection = makeThreadProjectionFixture();
  const at = (seconds: number) =>
    DateTime.makeUnsafe(`2026-01-01T00:00:${String(seconds).padStart(2, "0")}.000Z`);
  const runId = RunId.make("run");
  const planId = PlanId.make("plan");
  const nodeId = NodeId.make("node");
  const base = (id: string, second: number) => ({
    id: TurnItemId.make(id),
    threadId: projection.thread.id,
    runId,
    nodeId,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    ordinal: second,
    status: "completed" as const,
    title: null,
    startedAt: at(second),
    completedAt: at(second),
    updatedAt: at(second),
  });
  const first = {
    id: "a",
    text: "Read brief",
    status: "running" as const,
    durationAnchorAt: "2026-01-01T00:00:01.000Z",
  };
  const second = {
    id: "b",
    text: "Write",
    status: "running" as const,
    durationAnchorAt: "2026-01-01T00:00:10.000Z",
  };
  const steps = [
    { id: "a", text: "Read brief", status: "completed" as const, durationMs: 9000 },
    second,
  ];
  const items: OrchestrationV2TurnItem[] = [
    {
      ...base("plan-1", 1),
      type: "todo_list",
      planId,
      steps: [first, { id: "b", text: "Write", status: "pending" }],
    },
    {
      ...base("read", 2),
      type: "dynamic_tool",
      toolName: "read_file",
      input: { path: "brief.md" },
    },
    { ...base("plan-2", 10), type: "todo_list", planId, steps },
    { ...base("write", 10), type: "file_change", fileName: "answer.md" },
    {
      ...base("wrong-run", 11),
      runId: RunId.make("other"),
      type: "file_change",
      fileName: "other.md",
    },
    { ...base("no-time", 12), startedAt: null, type: "file_change", fileName: "unknown.md" },
  ];
  const progress: TaskProgressSnapshot = {
    planId,
    steps,
    completed: 1,
    total: 2,
    remaining: 1,
    state: "running",
    stale: false,
  };
  return {
    progress,
    projection: {
      ...projection,
      updatedAt: at(20),
      turnItems: items,
      plans: [
        {
          id: planId,
          threadId: projection.thread.id,
          runId,
          nodeId,
          kind: "todo_list" as const,
          status: "active" as const,
          steps,
        },
      ],
    },
  };
}
it("assigns activities only to proven running windows, exclusive at step boundaries and scoped to the run", () => {
  using _locale = testUiLocale("zh-CN");
  const { progress, projection } = fixture();
  const details = taskTrailDetails(progress, projection);
  expect(details.activities.a?.map((entry) => entry.path)).toEqual(["brief.md"]);
  expect(details.activities.b?.map((entry) => entry.path)).toEqual(["answer.md"]);
  expect(details.durationMs).toBeUndefined();
});
it("omits historical rows without a running window, pending anchors and absent projections", () => {
  using _locale = testUiLocale("zh-CN");
  const { progress, projection } = fixture();
  const onlyLatest = {
    ...projection,
    turnItems: projection.turnItems.filter((item) => item.id !== "plan-1"),
  };
  expect(taskTrailDetails(progress, onlyLatest).activities.a).toBeUndefined();
  const { planId: _planId, ...withoutPlan } = progress;
  expect(taskTrailDetails(withoutPlan, projection).activities).toEqual({});
  expect(taskTrailDetails(progress, null)).toEqual({ activities: {}, choices: [] });
});

it.each(["Bash", "exec_command", "run_command", "run_terminal_command"])(
  "renders normalized %s provider commands without rewriting records",
  (toolName) => {
    using _locale = testUiLocale("zh-CN");
    const native = fixture().projection.turnItems[1]!;
    if (native.type !== "dynamic_tool") throw new Error("Expected dynamic-tool fixture");
    const item = {
      ...native,
      type: "dynamic_tool" as const,
      toolName,
      input: { command: "/bin/zsh -lc 'cat /tmp/brief.md'", description: "读取任务说明" },
    };
    const before = JSON.stringify(item);
    expect(trailActivity(item)[0]).toMatchObject({
      kind: "command",
      label: "读取任务说明",
      status: "completed",
      command: "/bin/zsh -lc 'cat /tmp/brief.md'",
    });
    expect(JSON.stringify(item)).toBe(before);
    expect(trailActivity({ ...item, input: { cmd: "cat /tmp/brief.md" } })[0]).toMatchObject({
      label: "读取",
      path: "/tmp/brief.md",
    });
  },
);
it("keeps failed normalized commands failed even if the provider marked the item completed", () => {
  using _locale = testUiLocale("zh-CN");
  const native = fixture().projection.turnItems[1]!;
  if (native.type !== "dynamic_tool") throw new Error("Expected dynamic-tool fixture");
  const item = {
    ...native,
    type: "command_execution" as const,
    input: "vp test",
    exitCode: 1,
    output: "Tests 3 failed | 7 passed",
  };
  expect(trailActivity(item)[0]).toMatchObject({ label: "跑测试（失败 3）", status: "failed" });
});

it("uses the same failed-test result for Claude Bash with nested tool output", () => {
  using _locale = testUiLocale("zh-CN");
  const native = fixture().projection.turnItems[1]!;
  if (native.type !== "dynamic_tool") throw new Error("Expected dynamic-tool fixture");
  expect(
    trailActivity({
      ...native,
      toolName: "Bash",
      input: { command: "cd /work && vp test" },
      output: { stdout: "Tests 4 failed | 8 passed", exit_code: 1 },
    })[0],
  ).toMatchObject({
    label: "跑测试（失败 4）",
    status: "failed",
    command: "cd /work && vp test",
    path: "/work",
  });
});

it.each([
  ["rg needle docs", "", 1, "no_matches"],
  ["grep needle docs", "", 1, "no_matches"],
  ["/bin/zsh -lc 'cd docs && rg needle'", "", 1, "no_matches"],
  ["git grep needle", "", 1, "no_matches"],
  ["/bin/zsh -lc 'fd needle docs'", undefined, 1, "no_matches"],
  ["find . -name '*.csv'", "", 1, "no_matches"],
  ["rg needle docs", "Permission denied", 1, "failed"],
  ["rg needle docs", "", 2, "failed"],
  ["cat docs/*.txt", "", 1, "failed"],
  ["rg needle docs && false", "", 1, "failed"],
  ["rg needle docs 2>/dev/null", "", 1, "failed"],
] as const)("classifies %s with output %j and exit %d as %s", (input, output, exitCode, status) => {
  using _locale = testUiLocale("zh-CN");
  const item = fixture().projection.turnItems[1]!;
  if (item.type !== "dynamic_tool") throw new Error("Expected dynamic-tool fixture");
  expect(
    trailActivity({
      ...item,
      type: "command_execution",
      status: "failed",
      input,
      output,
      exitCode,
    })[0]?.status,
  ).toBe(status);
});

it("checks explicit stderr separately from stdout for shell tool searches", () => {
  using _locale = testUiLocale("zh-CN");
  const item = fixture().projection.turnItems[1]!;
  if (item.type !== "dynamic_tool") throw new Error("Expected dynamic-tool fixture");
  const search = {
    ...item,
    toolName: "Bash",
    input: { command: "rg --stats needle docs" },
    output: { stdout: "0 matches", stderr: "", exit_code: 1 },
    status: "failed" as const,
  };
  expect(trailActivity(search)[0]?.status).toBe("no_matches");
  expect(
    trailActivity({
      ...search,
      output: { ...search.output, stderr: "Permission denied" },
    })[0]?.status,
  ).toBe("failed");
  expect(
    trailActivity({
      ...search,
      input: { command: "find docs -name needle" },
    })[0]?.status,
  ).toBe("failed");
});

it("recognizes Antigravity dynamic tools and synthesizes live activity steps when no todo_list exists", () => {
  using _locale = testUiLocale("zh-CN");
  const { projection } = fixture();
  const baseTool = projection.turnItems[1]!;
  if (baseTool.type !== "dynamic_tool") throw new Error("Expected dynamic-tool fixture");
  const agyRead = {
    ...baseTool,
    toolName: "read_file",
    input: { Path: "/abs/src/spotlightSearchIndex.ts" },
    status: "completed" as const,
  };
  const agySubagent = {
    ...baseTool,
    toolName: "invoke_subagent",
    input: { Role: "Backend Bug Auditor" },
    status: "running" as const,
  };
  expect(trailActivity(agyRead)[0]).toMatchObject({
    kind: "read",
    path: "/abs/src/spotlightSearchIndex.ts",
  });
  expect(trailActivity(agySubagent)[0]).toMatchObject({
    kind: "delegate",
  });
  const run: OrchestrationV2Run = {
    id: baseTool.runId!,
    threadId: projection.thread.id,
    ordinal: 1,
    providerInstanceId: projection.thread.providerInstanceId,
    modelSelection: projection.thread.modelSelection,
    providerThreadId: null,
    userMessageId: MessageId.make("user-1"),
    rootNodeId: null,
    activeAttemptId: null,
    status: "running",
    requestedAt: projection.updatedAt,
    startedAt: projection.updatedAt,
    completedAt: null,
    checkpointId: null,
    contextHandoffId: null,
  };
  const noPlanProjection = {
    ...projection,
    runs: [run],
    plans: [],
    turnItems: [agyRead, agySubagent],
  };
  const snapshot = liveActivityTrailSnapshot(noPlanProjection, null, true);
  expect(snapshot).not.toBeNull();
  expect(snapshot?.progress.total).toBe(2);
  expect(snapshot?.progress.state).toBe("running");
  expect(Object.keys(snapshot?.details.activities ?? {})).toHaveLength(2);
});
