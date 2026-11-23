import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { useResumeCardStore } from "./resumeCardStore";
import { acknowledgeInboxMessage, dismissInboxRequest, nextInboxMorning } from "./inboxStrip";
const toast = vi.hoisted(() => ({ add: vi.fn(() => "toast"), close: vi.fn() }));
vi.mock("./components/ui/toast", () => ({ toastManager: toast }));
const ref = scopeThreadRef(EnvironmentId.make("local"), ThreadId.make("thread"));
const request = { key: scopedThreadKey(ref), token: "turn1", ref, title: "Task", reason: "待验收" };
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useResumeCardStore.setState({ selected: {}, hidden: {}, hiddenUntil: {} });
  useResumeCardStore.getState().open(request);
});
afterEach(() => vi.useRealTimers());
function undo() {
  const call = toast.add.mock.calls[0] as unknown as [{ actionProps: { onClick(): void } }];
  call[0].actionProps.onClick();
}
it("defers the actual action and suppresses duplicate clicks", async () => {
  const commit = vi.fn(async () => {});
  dismissInboxRequest(request, undefined, commit);
  dismissInboxRequest(request, undefined, commit);
  expect(commit).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(3000);
  expect(commit).toHaveBeenCalledTimes(1);
  expect(toast.add).toHaveBeenCalledTimes(1);
});
it("undo cancels the action and restores the same request", async () => {
  const commit = vi.fn(async () => {});
  dismissInboxRequest(request, undefined, commit);
  undo();
  await vi.advanceTimersByTimeAsync(4000);
  expect(commit).not.toHaveBeenCalled();
  expect(useResumeCardStore.getState().selected[request.key]).toEqual(request);
});
it("failed actions restore attention", async () => {
  dismissInboxRequest(request, undefined, async () => {
    throw new Error("offline");
  });
  await vi.advanceTimersByTimeAsync(3000);
  expect(useResumeCardStore.getState().selected[request.key]).toEqual(request);
  expect(toast.add).toHaveBeenCalledTimes(2);
});
it("does not dismiss for empty messages or another thread", () => {
  acknowledgeInboxMessage(request.key, "  ");
  acknowledgeInboxMessage("another", "hello");
  expect(useResumeCardStore.getState().selected[request.key]).toEqual(request);
  acknowledgeInboxMessage(request.key, "please revise");
  expect(useResumeCardStore.getState().hidden[request.key]).toBe(request.token);
  undo();
  expect(useResumeCardStore.getState().selected[request.key]).toEqual(request);
});
it("an expired reminder can be dismissed again", () => {
  useResumeCardStore.setState({
    hidden: { [request.key]: request.token },
    hiddenUntil: { [request.key]: 0 },
  });
  dismissInboxRequest(request);
  expect(toast.add).toHaveBeenCalledTimes(1);
  expect(useResumeCardStore.getState().hiddenUntil[request.key]).toBeUndefined();
});
it("tomorrow reminder means next calendar day at nine", () => {
  const date = new Date(2026, 10, 30, 23, 59);
  const next = new Date(nextInboxMorning(date));
  expect([next.getMonth(), next.getDate(), next.getHours(), next.getMinutes()]).toEqual([
    11, 1, 9, 0,
  ]);
});
it("undo never replaces newer attention", () => {
  dismissInboxRequest(request);
  const newer = { ...request, token: "turn2" };
  useResumeCardStore.getState().hide(newer);
  undo();
  expect(useResumeCardStore.getState().hidden[request.key]).toBe("turn2");
});

it("undo cannot overwrite a newer result opened during its timeout", () => {
  dismissInboxRequest(request);
  const newer = { ...request, token: "turn2" };
  useResumeCardStore.getState().open(newer);
  undo();
  expect(useResumeCardStore.getState().selected[request.key]).toEqual(newer);
});
