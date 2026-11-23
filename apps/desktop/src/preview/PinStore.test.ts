import { expect } from "vite-plus/test";
import { it } from "@effect/vitest";
import type { PreviewPin } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { PinStore } from "./PinStore.ts";
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

it.effect("atomically persists concurrent pages and preserves corrupt bytes before recovery", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "pin-store-" });
    let sequence = 0;
    const file = dir + "/preview-pins-v1.json",
      store = new PinStore(file, fs, async () => String(++sequence));
    expect(yield* Effect.promise(() => store.load("a"))).toEqual([]);
    yield* Effect.promise(() =>
      Promise.all([store.save("a", [pin]), store.save("b", [{ ...pin, id: "2" }])]),
    );
    expect(
      yield* Effect.promise(() => new PinStore(file, fs, async () => "reopen").load("a")),
    ).toEqual([pin]);
    expect(yield* Effect.promise(() => store.load("b"))).toHaveLength(1);
    yield* fs.writeFileString(file, "{broken-json");
    expect(yield* Effect.promise(() => store.load("a"))).toEqual([]);
    const backup = (yield* fs.readDirectory(dir)).find((name) => name.includes(".corrupt-"));
    expect(backup).toBeDefined();
    expect(yield* fs.readFileString(dir + "/" + backup)).toBe("{broken-json");
    yield* Effect.promise(() => store.save("a", [pin]));
    expect(yield* Effect.promise(() => store.load("a"))).toEqual([pin]);
  }).pipe(Effect.provide(NodeServices.layer)),
);
