import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

const listeners = new Map<EnvironmentId, Map<ThreadId, Set<Effect.Effect<void>>>>();

export const watchThreadCreation = Effect.fn("ThreadSubscriptionWakeups.watch")(function* (
  environmentId: EnvironmentId,
  threadId: ThreadId,
  wake: Effect.Effect<void>,
) {
  const environment = listeners.get(environmentId) ?? new Map();
  const thread = environment.get(threadId) ?? new Set();
  thread.add(wake);
  environment.set(threadId, thread);
  listeners.set(environmentId, environment);
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      thread.delete(wake);
      if (thread.size === 0) environment.delete(threadId);
      if (environment.size === 0) listeners.delete(environmentId);
    }),
  );
});

export const threadCreated = Effect.fn("ThreadSubscriptionWakeups.created")(function* (
  environmentId: EnvironmentId,
  threadId: ThreadId,
) {
  for (const wake of listeners.get(environmentId)?.get(threadId) ?? []) yield* wake;
});

export const threadsInShell = Effect.fn("ThreadSubscriptionWakeups.shell")(function* (
  environmentId: EnvironmentId,
  threads: ReadonlyArray<{ readonly id: ThreadId }>,
) {
  const environment = listeners.get(environmentId);
  if (!environment?.size) return;
  const ids = new Set(threads.map((thread) => thread.id));
  for (const [id, wakes] of environment) {
    if (ids.has(id)) for (const wake of wakes) yield* wake;
  }
});
