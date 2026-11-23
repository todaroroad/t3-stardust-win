import "~/index.css";
import { useRef } from "react";
import { expect, it, vi } from "vite-plus/test";
import {
  EnvironmentId,
  NodeId,
  RuntimeRequestId,
  TurnItemId,
  type OrchestrationV2ThreadProjection,
} from "@t3tools/contracts";
import { act, fakeTimers, render } from "../../../test/render";
import { makeThreadProjectionFixture } from "../../test-fixtures";
import { useComposerDraftStore } from "../../composerDraftStore";
import { usePendingThreadRequests, usePendingUserInputDraft } from "./usePendingThreadRequests";
import { TaskTrailDecision } from "./TaskTrailDecision";
import { TaskPlanCapsule } from "./TaskPlanCapsule";

function fixture() {
  const projection = makeThreadProjectionFixture();
  const id = RuntimeRequestId.make("c64-question");
  const nodeId = NodeId.make("c64-question");
  const questions = [0, 1].map((index) => ({
    id: `q${index}`,
    header: "方向",
    question: `选择方向 ${index + 1}`,
    options: [
      { label: "暖砂", description: "浅色封面", value: "sand" },
      { label: "墨绿", description: "深色封面", value: "green" },
    ],
  }));
  return {
    ...projection,
    runtimeRequests: [
      {
        id,
        nodeId,
        providerTurnId: null,
        nativeRequestRef: null,
        kind: "user_input" as const,
        status: "pending" as const,
        responseCapability: { type: "message" as const },
        createdAt: projection.updatedAt,
        resolvedAt: null,
      },
    ],
    turnItems: [
      {
        id: TurnItemId.make("c64-question"),
        threadId: projection.thread.id,
        runId: null,
        nodeId,
        providerThreadId: null,
        providerTurnId: null,
        nativeItemRef: null,
        parentItemId: null,
        ordinal: 0,
        status: "completed" as const,
        title: null,
        startedAt: projection.updatedAt,
        completedAt: projection.updatedAt,
        updatedAt: projection.updatedAt,
        type: "user_input_request" as const,
        requestId: id,
        questions,
      },
    ],
  } satisfies OrchestrationV2ThreadProjection;
}
function Probe({ projection }: { projection: OrchestrationV2ThreadProjection }) {
  const environmentId = EnvironmentId.make("c64-answers");
  const promptRef = useRef("");
  const composerRef = useRef(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const state = usePendingThreadRequests({
    environmentId,
    activeThreadId: projection.thread.id,
    serverProjection: projection,
    supportsQuestionAttachments: false,
    composerDraftTarget: { environmentId, threadId: projection.thread.id },
    setComposerDraftPrompt: (target, prompt) =>
      useComposerDraftStore.getState().setPrompt(target, prompt),
    promptRef,
    composerRef,
    setThreadError: () => {},
  });
  const pendingDraft = usePendingUserInputDraft({
    environmentId,
    activeThreadId: projection.thread.id,
    activePendingUserInput: state.activePendingUserInput,
    supportsQuestionAttachments: false,
  });
  const question = pendingDraft.activePendingProgress?.activeQuestion;
  return (
    <>
      <TaskPlanCapsule
        progress={{
          steps: [{ id: "pick", text: "选择封面", status: "running" }],
          completed: 0,
          total: 1,
          remaining: 1,
          state: "input",
          stale: false,
        }}
        {...(question && state.activePendingUserInput
          ? {
              decision: (
                <TaskTrailDecision
                  key={question.id}
                  input={{
                    requestId: state.activePendingUserInput.requestId,
                    question,
                    selectedValues: pendingDraft.activePendingProgress?.selectedOptionValues ?? [],
                    disabled: state.activePendingIsResponding,
                    canAdvance: pendingDraft.activePendingProgress?.canAdvance ?? false,
                    onSelect: state.onSelectActivePendingUserInputOption,
                    onAdvance: state.onAdvanceActivePendingUserInputStable,
                    onFocus: () => inputRef.current?.focus(),
                  }}
                />
              ),
            }
          : {})}
      />
      <input aria-label="补充要求" ref={inputRef} />
      <output>{JSON.stringify(pendingDraft.activePendingDraftAnswers)}</output>
    </>
  );
}
it("shows only a pending structured question and uses the existing answer store and advance path", async () => {
  const projection = fixture();
  await using screen = await render(<Probe projection={projection} />);
  using _timers = fakeTimers();
  await expect
    .element(screen.container.querySelector<HTMLElement>(".combo-decision")!)
    .toBeVisible();
  const choose = screen.container.querySelector<HTMLButtonElement>(".combo-options button")!;
  await act(() => choose.click());
  expect(screen.container.querySelector("output")?.textContent).toContain(
    '"selectedOptionValues":["sand"]',
  );
  await act(() => vi.advanceTimersByTimeAsync(200));
  expect(screen.container.querySelector(".combo-decision p")?.textContent).toBe("选择方向 2");
  await act(() =>
    screen.container.querySelector<HTMLButtonElement>(".combo-decision-more")!.click(),
  );
  expect(document.activeElement).toBe(screen.container.querySelector("input"));
  await screen.rerender(<Probe projection={{ ...projection, runtimeRequests: [] }} />);
  expect(screen.container.querySelector(".combo-decision")).toBeNull();
});
it("cancels a delayed single-choice advance when its request disappears", async () => {
  const next = vi.fn();
  const select = vi.fn();
  const question = fixture().turnItems[0]!.questions[0]!;
  await using screen = await render(
    <TaskTrailDecision
      input={{
        requestId: "cancel-test",
        question,
        selectedValues: [],
        disabled: false,
        canAdvance: true,
        onSelect: select,
        onAdvance: next,
        onFocus: () => {},
      }}
    />,
  );
  using _timers = fakeTimers();
  await act(() => screen.container.querySelector<HTMLButtonElement>("button")!.click());
  await screen.rerender(null);
  await act(() => vi.advanceTimersByTimeAsync(200));
  expect(next).not.toHaveBeenCalled();
});
