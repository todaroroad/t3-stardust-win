import { uiText } from "./i18n";
import type { EnvironmentId, WallArtifact } from "@t3tools/contracts";
import { useSyncExternalStore } from "react";
import { loadWallArtifacts } from "./lib/artifactWallClient";
import { usePreparedConnection } from "./state/session";

type Scope = "thread" | "project";
type Snapshot = {
  readonly artifacts: readonly WallArtifact[];
  readonly loading: boolean;
  readonly error: string | null;
};
const EMPTY: Snapshot = { artifacts: [], loading: true, error: null };
const entries = new Map<string, Collection>();

/** One cancellable poll per connection/collection, shared by the composer and the wall. */
class Collection {
  snapshot: Snapshot = EMPTY;
  readonly listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    readonly environmentId: EnvironmentId,
    readonly threadId: string,
    readonly scope: Scope,
    readonly connection: ReturnType<typeof usePreparedConnection>,
  ) {}
  private publish(snapshot: Snapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  private load = async () => {
    if (this.controller || this.listeners.size === 0) return;
    clearTimeout(this.timer);
    const controller = new AbortController();
    this.controller = controller;
    try {
      const result = await loadWallArtifacts(
        this.environmentId,
        this.threadId,
        this.scope,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      // Keep the snapshot stable when a poll returns the same metadata. Names, URLs and sizes
      // can change independently of modifiedAt, so comparing only IDs would leave stale UI.
      const artifacts =
        JSON.stringify(result) === JSON.stringify(this.snapshot.artifacts)
          ? this.snapshot.artifacts
          : result;
      if (artifacts !== this.snapshot.artifacts || this.snapshot.loading || this.snapshot.error) {
        this.publish({ artifacts, loading: false, error: null });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : uiText("Couldn’t read artifacts");
      // A repeating poll failure must not wake every subscriber (and ChatView) every 15 seconds.
      if (
        !controller.signal.aborted &&
        (this.snapshot.loading || this.snapshot.error !== message)
      ) {
        this.publish({ artifacts: this.snapshot.artifacts, loading: false, error: message });
      }
    } finally {
      if (this.controller === controller) {
        this.controller = null;
        if (this.listeners.size > 0)
          this.timer = setTimeout(this.poll, this.scope === "project" ? 60_000 : 30_000);
      }
    }
  };
  private poll = () => {
    if (document.visibilityState === "visible") void this.load();
    else this.timer = setTimeout(this.poll, this.scope === "project" ? 60_000 : 30_000);
  };
  private onVisible = () => {
    if (document.visibilityState === "visible") void this.load();
  };
  retry = () => {
    if (this.controller) return;
    this.publish({ ...this.snapshot, loading: true, error: null });
    void this.load();
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      document.addEventListener("visibilitychange", this.onVisible);
      void this.load();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        clearTimeout(this.timer);
        document.removeEventListener("visibilitychange", this.onVisible);
        this.controller?.abort();
        this.controller = null;
        // Do not retain a previous consumer's stale list or error on reopening the collection.
        this.snapshot = EMPTY;
      }
    };
  };
  read = () => this.snapshot;
}

function collection(
  environmentId: EnvironmentId,
  threadId: string,
  scope: Scope,
  connection: ReturnType<typeof usePreparedConnection>,
) {
  const key = JSON.stringify([environmentId, threadId, scope]);
  let entry = entries.get(key);
  if (!entry || entry.connection !== connection) {
    entry = new Collection(environmentId, threadId, scope, connection);
    entries.set(key, entry);
  }
  // Active consumers keep their entries; only unused collections may be evicted.
  if (entries.size > 16) {
    for (const [oldKey, oldEntry] of entries) {
      if (oldEntry !== entry && oldEntry.listeners.size === 0) entries.delete(oldKey);
      if (entries.size <= 16) break;
    }
  }
  return entry;
}

const readEmpty = () => EMPTY;
const emptySubscribe = () => () => {};

export function useWallArtifacts(
  environmentId: EnvironmentId,
  threadId: string,
  scope: Scope = "thread",
  enabled = true,
) {
  const connection = usePreparedConnection(environmentId);
  const entry = enabled ? collection(environmentId, threadId, scope, connection) : null;
  const snapshot = useSyncExternalStore(
    entry?.subscribe ?? emptySubscribe,
    entry?.read ?? readEmpty,
    readEmpty,
  );
  return { ...snapshot, retry: entry?.retry ?? (() => {}) };
}
