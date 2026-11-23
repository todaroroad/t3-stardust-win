import { it, expect } from "vite-plus/test";
import type { PreviewPin } from "@t3tools/contracts";
import { previewPinKey, filterPreviewPins, previewPinsPayload } from "./previewPins.ts";
const pin: PreviewPin = {
  id: "pin-1",
  number: 1,
  text: "按钮加宽",
  selectorChain: ["#pay"],
  tag: "button",
  elementText: "Pay",
  ancestor: null,
  relative: { x: 0.5, y: 0.5 },
  documentPosition: { x: 0.5, y: 0.5 },
  rect: { x: 0, y: 0, width: 20, height: 20 },
  pageKey: "http://localhost/page",
  createdAt: "2026-11-16T12:00:00Z",
  status: "unsent",
  screenshot: null,
  element: {
    pageUrl: "http://localhost/page",
    pageTitle: "Sample",
    tagName: "BUTTON",
    selector: "#pay",
    htmlPreview: '<button id="pay">Pay</button>',
    componentName: null,
    source: null,
    stack: [],
    styles: "",
    pickedAt: "2026-11-16T12:00:00Z",
  },
};

it("uses stable local document keys across random ports and fragments", () => {
  expect(previewPinKey("http://localhost:1234/page#x")).toBe(
    previewPinKey("http://localhost:5678/page#y"),
  );
  expect(previewPinKey("https://example.com:8443/page")).not.toBe(
    previewPinKey("https://example.com/page"),
  );
  expect(previewPinKey("http://localhost:33/x", "/a/b.html")).toBe("file:/a/b.html");
});
it("filters by resolution and sends only unsent pins in one numbered payload", () => {
  const pins = [
    pin,
    { ...pin, id: "2", number: 2, status: "sent" as const },
    { ...pin, id: "3", number: 3, status: "fixed" as const },
  ];
  expect(filterPreviewPins(pins, "all")).toHaveLength(3);
  expect(filterPreviewPins(pins, "pending")).toHaveLength(2);
  expect(filterPreviewPins(pins, "fixed")).toHaveLength(1);
  const payload = previewPinsPayload(
    pins,
    "batch",
    "http://localhost/page",
    "Sample",
    pin.createdAt,
  );
  expect(payload.pins).toEqual([pin]);
  expect(payload.elements).toHaveLength(1);
  expect(payload.comment).toContain("1. 按钮加宽");
  expect(payload.comment).toContain("#pay");
  expect(payload.comment).not.toContain("2.");
});
