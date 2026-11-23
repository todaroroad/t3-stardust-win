import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as Electron from "electron";

// A host the backend must reach for ChatGPT sign-in; PAC scripts may route it differently from LAN hosts.
const PROBE_URL = "https://auth.openai.com/";
const LOOPBACK_NO_PROXY = ["localhost", "127.0.0.1", "::1", "*.local"];
const PROXY_ENV_NAMES = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"] as const;

/**
 * GUI launches inherit no proxy variables, and the backend's Node fetch ignores the
 * macOS system proxy, so users behind Clash-style system proxies could not reach
 * auth.openai.com. Mirrors the system proxy into the backend's environment.
 */
export const systemProxyEnvPatch = (
  resolved: string,
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> => {
  const hasEnvProxy = PROXY_ENV_NAMES.some((name) => (env[name] ?? "").trim() !== "");
  // A proxy the user exported wins; Node only honors it once NODE_USE_ENV_PROXY is set.
  if (hasEnvProxy) return { NODE_USE_ENV_PROXY: "1" };
  // Chromium answers like "PROXY host:port; DIRECT". Node's env proxy has no SOCKS support.
  const entry = resolved
    .split(";")
    .map((part) => part.trim().split(/\s+/u))
    .find(([scheme]) => scheme === "PROXY" || scheme === "HTTPS");
  if (!entry || entry.length < 2) return {};
  const [scheme, hostPort] = entry as [string, string];
  if (!/^[\w.-]+:\d{1,5}$|^\[[\da-f:]+\]:\d{1,5}$/iu.test(hostPort)) return {};
  const url = `${scheme === "HTTPS" ? "https" : "http"}://${hostPort}`;
  const existingNoProxy = (env.NO_PROXY ?? env.no_proxy ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
  const noProxy = [...new Set([...existingNoProxy, ...LOOPBACK_NO_PROXY])].join(",");
  return {
    HTTPS_PROXY: url,
    https_proxy: url,
    HTTP_PROXY: url,
    http_proxy: url,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
    NODE_USE_ENV_PROXY: "1",
  };
};

export class DesktopSystemProxy extends Context.Service<
  DesktopSystemProxy,
  {
    /** Environment additions for a local backend; empty when no usable proxy is found. */
    readonly backendEnvPatch: Effect.Effect<Record<string, string>>;
  }
>()("@t3tools/desktop/backend/DesktopSystemProxy") {}

export const layer = Layer.succeed(DesktopSystemProxy, {
  // A rejection becomes a defect here; catchCause below turns any failure into a direct backend.
  backendEnvPatch: Effect.promise(() =>
    Electron.session.defaultSession.resolveProxy(PROBE_URL),
  ).pipe(
    Effect.timeout("2 seconds"),
    Effect.map((resolved) => systemProxyEnvPatch(resolved, process.env)),
    Effect.tap((patch) =>
      Effect.logInfo("Backend proxy environment resolved", {
        proxy: patch.HTTPS_PROXY ?? (patch.NODE_USE_ENV_PROXY ? "inherited" : "direct"),
      }),
    ),
    Effect.catchCause((cause) =>
      Effect.logWarning("Could not resolve the system proxy for the backend", { cause }).pipe(
        Effect.as({}),
      ),
    ),
  ),
});
