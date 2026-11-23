import * as NodeFS from "node:fs";
const targets = await (await fetch("http://127.0.0.1:9334/json/list")).json();
const t = targets.find((t) => t.type === "page" && t.url.startsWith("t3code:"));
if (!t) throw Error("Owned candidate page unavailable");
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const d = JSON.parse(e.data);
  if (d.id) {
    const f = pending.get(d.id);
    pending.delete(d.id);
    d.error ? f.reject(d.error) : f.resolve(d.result);
  }
};
export const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
export const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception.description);
  return r.result.value;
};
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const shot = async (name, blur = true) => {
  if (blur) await ev("document.activeElement?.blur()");
  const img = await send("Page.captureScreenshot", { format: "png" });
  const path = "media/c72-" + name + ".png";
  NodeFS.writeFileSync(path, Buffer.from(img.data, "base64"));
  return path;
};
export const close = () => ws.close();
if (!(await ev("innerWidth===1440 && innerHeight===1000")))
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
