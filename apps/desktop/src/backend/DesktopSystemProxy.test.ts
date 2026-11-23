import { assert, describe, it } from "@effect/vitest";
import { vi } from "vite-plus/test";

vi.mock("electron", () => ({ session: {} }));

import { systemProxyEnvPatch } from "./DesktopSystemProxy.ts";

describe("systemProxyEnvPatch", () => {
  it("mirrors a Clash-style system proxy into the backend env", () => {
    const patch = systemProxyEnvPatch("PROXY 127.0.0.1:7897; DIRECT", {});
    assert.strictEqual(patch.HTTPS_PROXY, "http://127.0.0.1:7897");
    assert.strictEqual(patch.http_proxy, "http://127.0.0.1:7897");
    assert.strictEqual(patch.NODE_USE_ENV_PROXY, "1");
    assert.include(patch.NO_PROXY, "127.0.0.1");
    assert.include(patch.NO_PROXY, "localhost");
  });

  it("keeps a proxy the user exported and only turns on Node's env proxy support", () => {
    assert.deepStrictEqual(
      systemProxyEnvPatch("PROXY 127.0.0.1:7897", { https_proxy: "http://10.0.0.2:3128" }),
      { NODE_USE_ENV_PROXY: "1" },
    );
  });

  it("keeps existing NO_PROXY entries", () => {
    const patch = systemProxyEnvPatch("HTTPS proxy.corp:443", { NO_PROXY: "intranet.corp" });
    assert.strictEqual(patch.HTTPS_PROXY, "https://proxy.corp:443");
    assert.isTrue(patch.NO_PROXY!.startsWith("intranet.corp,"));
  });

  it("adds nothing for direct or SOCKS-only answers", () => {
    assert.deepStrictEqual(systemProxyEnvPatch("DIRECT", {}), {});
    assert.deepStrictEqual(systemProxyEnvPatch("SOCKS5 127.0.0.1:7891", {}), {});
    assert.deepStrictEqual(systemProxyEnvPatch("PROXY not a host", {}), {});
  });
});
