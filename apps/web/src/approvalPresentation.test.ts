import { testUiLocale } from "../test/uiLocale";
import { expect, it } from "vite-plus/test";
import { RuntimeRequestId, NodeId, PlanId, RunId, TurnItemId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { makeThreadProjectionFixture } from "./test-fixtures";
import {
  approvalPresentation,
  approvalResultLabel,
  trailApprovalResults,
} from "./approvalPresentation";

it("classifies conservatively without treating compound commands as read-only", () => {
  using _locale = testUiLocale("zh-CN");
  const base = {
    requestId: RuntimeRequestId.make("id"),
    requestKind: "command" as const,
    createdAt: "",
    responseCapability: "live" as const,
  };
  expect(approvalPresentation({ ...base, detail: "ls -la" }).risk).toContain("低风险");
  for (const detail of [
    "ls; deploy",
    "cat file > output",
    "ls $(run)",
    "ls\ndeploy",
    "python custom.py",
  ])
    expect(approvalPresentation({ ...base, detail }).risk).toBeNull();
  expect(approvalPresentation({ ...base, detail: "rm -rf generated" }).risk).toContain("高风险");
  expect(approvalPresentation({ ...base, detail: "pnpm install" }).risk).toContain("需留意");
  expect(
    approvalPresentation({ ...base, requestKind: "file-change", detail: "src/a.ts" }).risk,
  ).toContain("中风险");
  expect(
    approvalPresentation({ ...base, requestKind: "file-change", reason: "outside the workspace" })
      .title,
  ).toContain("工作区以外");
  expect(
    approvalPresentation({ ...base, requestKind: "permission", detail: "Custom tool" }).risk,
  ).toBeNull();
  expect(approvalResultLabel("acceptAlways")).toContain("始终允许");
});
it("shows only server-resolved decisions belonging to the displayed plan's run", () => {
  using _locale = testUiLocale("zh-CN");
  const projection = makeThreadProjectionFixture();
  const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
  const runId = RunId.make("current");
  const nodeId = NodeId.make("node");
  const planId = PlanId.make("plan");
  const requests = ["yes", "no", "old", "pending", "expired"].map((id) => ({
    id: RuntimeRequestId.make(id),
    nodeId,
    providerTurnId: null,
    nativeRequestRef: null,
    kind: "command" as const,
    status:
      id === "pending"
        ? ("pending" as const)
        : id === "expired"
          ? ("expired" as const)
          : ("resolved" as const),
    responseCapability: { type: "not_resumable" as const, reason: "done" },
    createdAt: now,
    resolvedAt: now,
    decision: id === "no" ? ("decline" as const) : ("accept" as const),
  }));
  const turnItems = requests.map((request, ordinal) => ({
    id: TurnItemId.make(request.id),
    threadId: projection.thread.id,
    runId: request.id === "old" ? RunId.make("old") : runId,
    nodeId,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    ordinal,
    status: "completed" as const,
    title: null,
    startedAt: now,
    completedAt: now,
    updatedAt: now,
    type: "approval_request" as const,
    requestId: request.id,
    requestKind: "command" as const,
  }));
  const progress = {
    planId,
    steps: [],
    total: 0,
    completed: 0,
    remaining: 0,
    state: "running" as const,
    stale: false,
  };
  const data = {
    ...projection,
    runtimeRequests: requests,
    turnItems,
    plans: [
      {
        id: planId,
        threadId: projection.thread.id,
        runId,
        nodeId,
        kind: "todo_list" as const,
        status: "active" as const,
        steps: [],
      },
    ],
  };
  expect(trailApprovalResults(data, progress).map((result) => result.requestId)).toEqual([
    "yes",
    "no",
  ]);
  expect(trailApprovalResults(data, { ...progress, planId: "missing" })).toEqual([]);
});
