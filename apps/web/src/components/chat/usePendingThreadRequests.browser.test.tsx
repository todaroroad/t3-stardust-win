import { useRef } from "react";
import {
  EnvironmentId,
  NodeId,
  RuntimeRequestId,
  TurnItemId,
  type OrchestrationV2ThreadProjection,
} from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { AsyncResult } from "effect/reactivity";
import * as Cause from "effect/Cause";
import { act, render } from "../../../test/render";
import { makeThreadProjectionFixture } from "../../test-fixtures";

const state = vi.hoisted(() => ({ allowed: true, respond: vi.fn() }));
vi.mock(import("../../state/session"), async (original) => ({
  ...(await original()),
  readEnvironmentScope: (() => state.allowed) as never,
}));
vi.mock(import("../../state/use-orchestration-command"), async (original) => ({
  ...(await original()),
  useOrchestrationCommand: (() => state.respond) as never,
}));
import { usePendingThreadRequests } from "./usePendingThreadRequests";
import { TaskTrailApproval } from "./TaskTrailApproval";

function fixture(): OrchestrationV2ThreadProjection {
  const base = makeThreadProjectionFixture();
  const requestId = RuntimeRequestId.make("approval");
  const nodeId = NodeId.make("node");
  return {
    ...base,
    runtimeRequests: [
      {
        id: requestId,
        nodeId,
        providerTurnId: null,
        nativeRequestRef: null,
        kind: "command",
        status: "pending",
        responseCapability: { type: "live", providerSessionId: base.thread.id as never },
        createdAt: base.updatedAt,
        resolvedAt: null,
      },
    ],
    turnItems: [
      {
        id: TurnItemId.make("approval"),
        threadId: base.thread.id,
        runId: null,
        nodeId,
        providerThreadId: null,
        providerTurnId: null,
        nativeItemRef: null,
        parentItemId: null,
        ordinal: 0,
        status: "waiting",
        title: null,
        startedAt: base.updatedAt,
        completedAt: null,
        updatedAt: base.updatedAt,
        type: "approval_request",
        requestId,
        requestKind: "command",
        prompt: "pwd",
        options: [
          { decision: "accept", label: "批准" },
          { decision: "decline", label: "拒绝" },
        ],
      },
    ],
  };
}
function Probe({ projection }: { projection: OrchestrationV2ThreadProjection }) {
  const promptRef = useRef("");
  const composerRef = useRef(null);
  const requests = usePendingThreadRequests({
    environmentId: EnvironmentId.make("c66-remote"),
    activeThreadId: projection.thread.id,
    serverProjection: projection,
    supportsQuestionAttachments: false,
    composerDraftTarget: {
      environmentId: EnvironmentId.make("c66-remote"),
      threadId: projection.thread.id,
    },
    setComposerDraftPrompt: () => {},
    promptRef,
    composerRef,
    setThreadError: () => {},
  });
  return (
    <>
      <TaskTrailApproval
        input={{
          pending: requests.pendingApprovals,
          respondingRequestIds: requests.respondingRequestIds,
          disabled: false,
          onRespond: requests.onRespondToApproval,
        }}
      />
      <button
        onClick={() =>
          void requests.onRespondToApproval(RuntimeRequestId.make("approval"), "decline")
        }
      >
        并发入口
      </button>
    </>
  );
}
it("submits the existing scoped command once, clears in-flight after failure and enforces environment scope", async () => {
  state.allowed = true;
  state.respond.mockReset();
  let finish!: (value: unknown) => void;
  state.respond
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(AsyncResult.success(undefined));
  const projection = fixture();
  await using screen = await render(<Probe projection={projection} />);
  await screen.getByRole("button", { name: "批准", exact: true }).click();
  await screen.getByRole("button", { name: "并发入口" }).click();
  expect(state.respond).toHaveBeenCalledTimes(1);
  expect(state.respond).toHaveBeenLastCalledWith({
    environmentId: "c66-remote",
    input: { threadId: projection.thread.id, requestId: "approval", decision: "accept" },
  });
  await act(() => finish(AsyncResult.failure(Cause.fail(new Error("offline")))));
  await expect.element(screen.getByRole("alert")).toBeVisible();
  await screen.getByRole("button", { name: "拒绝", exact: true }).click();
  expect(state.respond).toHaveBeenLastCalledWith({
    environmentId: "c66-remote",
    input: { threadId: projection.thread.id, requestId: "approval", decision: "decline" },
  });
  state.allowed = false;
  await screen.getByRole("button", { name: "并发入口" }).click();
  expect(state.respond).toHaveBeenCalledTimes(2);
  state.allowed = true;
  await screen.rerender(<Probe projection={{ ...projection, runtimeRequests: [] }} />);
  await screen.getByRole("button", { name: "并发入口" }).click();
  expect(state.respond).toHaveBeenCalledTimes(2);
});
