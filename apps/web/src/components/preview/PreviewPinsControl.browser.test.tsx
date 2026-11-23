import { testUiLocale } from "../../../test/uiLocale";
import { expect, it, vi } from "vite-plus/test";
import type { PreviewAnnotationSubmissionResult } from "@t3tools/contracts";
import { render, act } from "../../../test/render";
import { PreviewPinsControl } from "./PreviewPinsControl";
const bridge = vi.hoisted(() => ({
  listener: null as null | ((id: string, count: number) => void),
  resolve: null as null | ((value: PreviewAnnotationSubmissionResult | null) => void),
  setAnnotationSendEnabled: vi.fn(async () => {}),
  pickElement: vi.fn(
    () =>
      new Promise<PreviewAnnotationSubmissionResult | null>((resolve) => {
        bridge.resolve = resolve;
      }),
  ),
  pinAction: vi
    .fn<(tabId: string, action: string, ids: readonly string[]) => Promise<void>>()
    .mockResolvedValue(undefined),
  cancelPickElement: vi.fn(async () => {
    bridge.resolve?.(null);
  }),
  onPinState: (callback: (id: string, count: number) => void) => {
    bridge.listener = callback;
    return () => {
      bridge.listener = null;
    };
  },
}));
vi.mock("./previewBridge", () => ({ previewBridge: bridge }));
it("sends one batch, acknowledges only accepted messages, and disconnects on close", async () => {
  using _locale = testUiLocale("zh-CN");
  const onSend = vi.fn(async () => true);
  await using screen = await render(
    <PreviewPinsControl
      tabId="tab"
      url="http://localhost/page"
      loading={false}
      enabled
      onSend={onSend}
    />,
  );
  await screen.getByRole("button", { name: "批注", exact: true }).click();
  await expect.poll(() => bridge.pickElement.mock.calls.length).toBe(1);
  await act(() => bridge.listener?.("tab", 3));
  await screen.getByRole("button", { name: "发给助手（3）" }).click();
  expect(bridge.pinAction).toHaveBeenCalledWith("tab", "send", []);
  const annotation = {
    id: "batch",
    pageUrl: "http://localhost/page",
    pageTitle: "Sample",
    createdAt: "2026-11-16T00:00:00Z",
    comment: "1. 加宽\n2. 对齐\n3. 留白",
    elements: [],
    regions: [],
    strokes: [],
    styleChanges: [],
    screenshot: null,
    pins: [],
  };
  await act(() => bridge.resolve?.({ annotation, submission: "send" }));
  await expect.poll(() => onSend.mock.calls.length).toBe(1);
  await expect
    .poll(() => bridge.pinAction.mock.calls.some((call) => call[1] === "accepted"))
    .toBe(true);
  await expect.poll(() => bridge.pickElement.mock.calls.length).toBe(2);
  const closeCallsBeforeTakeover = bridge.pinAction.mock.calls.filter(
    (call) => call[1] === "close",
  ).length;
  await act(() => bridge.resolve?.(null));
  await expect
    .element(screen.getByRole("button", { name: "批注", exact: true }))
    .toHaveAttribute("aria-pressed", "false");
  expect(bridge.pinAction.mock.calls.filter((call) => call[1] === "close").length).toBe(
    closeCallsBeforeTakeover,
  );
  await screen.getByRole("button", { name: "批注", exact: true }).click();
  await expect.poll(() => bridge.pickElement.mock.calls.length).toBe(3);
  await screen.getByRole("button", { name: "批注", exact: true }).click();
  expect(bridge.pinAction).toHaveBeenCalledWith("tab", "close", []);
  await screen.unmount();
  expect(bridge.listener).toBeNull();
});
