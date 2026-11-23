// @effect-diagnostics nodeBuiltinImport:off - the persistent SQLite worker stays outside the server event loop.
import * as NodeChildProcess from "node:child_process";
import * as NodeReadline from "node:readline";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Path from "effect/Path";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { OrchestrationSearchThreadsResult } from "@t3tools/contracts";
import * as ServerConfig from "../config.ts";
export class SpotlightSearchError extends Schema.TaggedError<SpotlightSearchError>()(
  "SpotlightSearchError",
  { message: Schema.String },
) {}
export class SpotlightSearch extends Context.Service<
  SpotlightSearch,
  {
    readonly search: (
      query: string,
      limit: number,
    ) => Effect.Effect<OrchestrationSearchThreadsResult, SpotlightSearchError>;
  }
>()("t3/orchestration-v2/SpotlightSearch") {}
const decodeResult = Schema.decodeUnknownEffect(OrchestrationSearchThreadsResult);
const encodeWorkerOptions = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const isSpotlightSearchError = Schema.is(SpotlightSearchError);
export const layer = Layer.effect(
  SpotlightSearch,
  Effect.gen(function* () {
    const config = yield* ServerConfig.ServerConfig;
    const path = yield* Path.Path;
    const executable = yield* HostProcess.ExecutablePath;
    const packaged = yield* HostProcess.IsExecutable;
    const environment = yield* HostProcess.Environment;
    const source = import.meta.url.endsWith(".ts");
    const args = packaged
      ? ["__spotlight-search"]
      : [
          yield* path.fromFileUrl(
            new URL(
              source ? "../spotlight-search-worker.ts" : "./spotlight-search-worker.mjs",
              import.meta.url,
            ),
          ),
        ];
    const options = yield* encodeWorkerOptions({
      dbPath: config.dbPath,
      cachePath: path.join(config.providerStatusCacheDir, "spotlight-v2.sqlite"),
      aliasesPath: path.join(config.stateDir, "search-aliases.json"),
    }).pipe(Effect.orDie);
    let worker: NodeChildProcess.ChildProcessWithoutNullStreams | undefined;
    let serial = 0;
    const pending = new Map<
      number,
      { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();
    const stop = (current: NodeChildProcess.ChildProcessWithoutNullStreams, message: string) => {
      if (worker !== current) return;
      worker = undefined;
      for (const request of pending.values()) request.reject(new SpotlightSearchError({ message }));
      pending.clear();
      current.kill();
    };
    yield* Effect.addFinalizer(() =>
      Effect.promise(
        () =>
          new Promise<void>((resolve) => {
            const current = worker;
            if (!current || current.exitCode !== null || current.signalCode !== null)
              return resolve();
            current.once("close", () => resolve());
            stop(current, "Search stopped");
          }),
      ),
    );
    return SpotlightSearch.of({
      search: Effect.fn("SpotlightSearch.search")(function* (query, limit) {
        const raw = yield* Effect.tryPromise({
          try: (signal) =>
            new Promise<unknown>((resolve, reject) => {
              if (!worker) {
                const current = NodeChildProcess.spawn(executable, [...args, options], {
                  env: { ...environment, ELECTRON_RUN_AS_NODE: "1" },
                  stdio: "pipe",
                });
                worker = current;
                const lines = NodeReadline.createInterface({ input: current.stdout });
                lines.on("line", (line) => {
                  try {
                    const message = JSON.parse(line) as {
                      id: number;
                      matches?: unknown;
                      error?: string;
                    };
                    if (worker !== current) return;
                    const request = pending.get(message.id);
                    if (!request) return;
                    pending.delete(message.id);
                    if (message.error)
                      request.reject(new SpotlightSearchError({ message: message.error }));
                    else request.resolve({ matches: message.matches });
                  } catch {
                    stop(current, "Invalid search response");
                  }
                });
                current.stderr.resume();
                current.stdin.on("error", () => stop(current, "本地搜索进程已停止"));
                current.on("error", () => stop(current, "本地搜索暂不可用"));
                current.on("exit", () => {
                  lines.close();
                  stop(current, "本地搜索已停止");
                });
              }
              const id = ++serial;
              const abort = () => {
                pending.delete(id);
                reject(new SpotlightSearchError({ message: "Search cancelled" }));
              };
              signal.addEventListener("abort", abort, { once: true });
              const cleanup = () => signal.removeEventListener("abort", abort);
              pending.set(id, {
                resolve: (value) => {
                  cleanup();
                  resolve(value);
                },
                reject: (error) => {
                  cleanup();
                  reject(error);
                },
              });
              worker.stdin.write(JSON.stringify({ id, query, limit }) + "\n");
            }),
          catch: (cause) =>
            isSpotlightSearchError(cause)
              ? cause
              : new SpotlightSearchError({ message: "本地搜索失败" }),
        });
        return yield* decodeResult(raw).pipe(
          Effect.mapError(() => new SpotlightSearchError({ message: "Invalid search response" })),
        );
      }),
    });
  }),
);
