// @effect-diagnostics nodeBuiltinImport:off - host paths, statfs and a fixed `open` for the rescue folder.
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import {
  StorageTidyError,
  type StorageTidyActionInput,
  type StorageTidyState,
  type StorageTidyVolume,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Scope from "effect/Scope";

import * as ServerConfig from "./config.ts";
import * as ServerSettings from "./serverSettings.ts";
import * as StorageCleanup from "./storageCleanup.ts";
import { cleanupRoots, cleanupStagingDir, scanCleanup } from "./storageMole.ts";
import { previewWithMole } from "./storageMoleList.ts";
import { createStorageTidyEngine } from "./storageTidy.ts";
import { guardCode, runGit, runTar } from "./storageTidyFs.ts";
import { managedWorktreesDirectories } from "./worktreesDirectory.ts";

export class StorageTidy extends Context.Service<
  StorageTidy,
  {
    readonly state: Effect.Effect<StorageTidyState, StorageTidyError>;
    readonly act: (
      input: StorageTidyActionInput,
    ) => Effect.Effect<StorageTidyState, StorageTidyError>;
  }
>()("t3/storageTidyService/StorageTidy") {}

/** Internal disk plus mounted external disks, from statfs; no helper program is needed. */
export async function listTidyVolumes(): Promise<StorageTidyVolume[]> {
  const rows: StorageTidyVolume[] = [];
  const seen = new Set<number>();
  const add = async (path: string, name: string, internal: boolean) => {
    try {
      const [st, fs] = await Promise.all([NodeFSP.stat(path), NodeFSP.statfs(path)]);
      if (seen.has(st.dev)) return;
      seen.add(st.dev);
      rows.push({
        id: String(st.dev),
        name,
        path,
        totalBytes: fs.blocks * fs.bsize,
        freeBytes: fs.bavail * fs.bsize,
        internal,
      });
    } catch {
      /* Offline or unreadable. */
    }
  };
  let internalName = "Macintosh HD";
  const names = await NodeFSP.readdir("/Volumes").catch(() => [] as string[]);
  for (const name of names) {
    const link = await NodeFSP.lstat(NodePath.join("/Volumes", name)).catch(() => null);
    if (link?.isSymbolicLink() && (await NodeFSP.realpath(NodePath.join("/Volumes", name)).catch(() => "")) === "/")
      internalName = name;
  }
  await add("/", internalName, true);
  for (const name of names.toSorted().slice(0, 12)) {
    const path = NodePath.join("/Volumes", name);
    const link = await NodeFSP.lstat(path).catch(() => null);
    if (link?.isDirectory() && !link.isSymbolicLink()) await add(path, name, false);
  }
  // Recovery and other volumes of the internal APFS container report the container's own numbers.
  const internal = rows[0];
  return rows.filter(
    (row, index) =>
      index === 0 ||
      !(internal && row.totalBytes === internal.totalBytes && row.freeBytes === internal.freeBytes),
  );
}

const make = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const settings = yield* ServerSettings.ServerSettingsService;
  const cleanup = yield* StorageCleanup.StorageCleanup;
  const path = yield* Path.Path;
  const scope = yield* Scope.Scope;
  const context = yield* Effect.context<never>();
  const runPromise = Effect.runPromiseWith(context);
  const home = NodeOS.homedir();

  const engine = createStorageTidyEngine({
    roots: {
      home,
      applications: "/Applications",
      tmp: "/tmp",
      stateDir: config.stateDir,
      rescueRoot: NodePath.join(home, "Documents", "T3 Stardust 抢救"),
      codexSessions: NodePath.join(home, ".codex", "sessions"),
      claudeProjects: NodePath.join(home, ".claude", "projects"),
      t3Data: [config.dbPath, config.attachmentsDir, config.logsDir],
      stagingDir: cleanupStagingDir(),
    },
    now: Date.now,
    uid: process.getuid ? process.getuid() : null,
    git: runGit,
    tar: runTar,
    mole: () => previewWithMole({ home }),
    devCaches: async () =>
      (await scanCleanup(cleanupRoots(), [], undefined, 12_000)).entries
        .filter((entry) => entry.category === "developer-cache" && entry.rebuildable && !entry.locked && entry.canRelease)
        .map((entry) => ({ path: entry.path, name: entry.name })),
    volumes: listTidyVolumes,
    worktreeDirs: () =>
      runPromise(
        settings.getSettings.pipe(
          Effect.map((current) => managedWorktreesDirectories(current, config.worktreesDir, path, home)),
          Effect.orElseSucceed(() => [config.worktreesDir] as ReadonlyArray<string>),
        ),
      ),
    openPath: (target) =>
      new Promise<void>((resolve, reject) => {
        // Fixed program; the folder was recorded by this app inside its own rescue root.
        NodeChildProcess.execFile("/usr/bin/open", [target], (error) => (error ? reject(error) : resolve()));
      }),
  });

  const fail = (error: unknown) => new StorageTidyError({ message: guardCode(error) });
  const state = Effect.tryPromise({ try: () => engine.state(), catch: fail });
  const logged = (name: string, work: () => Promise<unknown>) =>
    Effect.tryPromise({ try: work, catch: fail }).pipe(
      Effect.catch((error) => Effect.logWarning(`Storage tidy ${name} failed`, { error: error.message })),
    );

  const act = Effect.fn("StorageTidy.act")(function* (input: StorageTidyActionInput) {
    switch (input.action) {
      case "scan":
        // Starts at once so the next state read already reports "scanning".
        yield* Effect.sync(() => void engine.scan().catch(() => undefined));
        break;
      case "execute":
        yield* cleanup
          .withMaintenanceLock(logged("execute", () => engine.execute(input.itemIds, input.rescue)))
          .pipe(Effect.forkIn(scope));
        break;
      case "undo":
        yield* Effect.tryPromise({ try: () => engine.undo(input.operationId), catch: fail });
        break;
      case "settings":
        yield* Effect.tryPromise({
          try: () =>
            engine.saveSettings({
              ...(input.buildDirectory !== undefined ? { buildDirectory: input.buildDirectory } : {}),
              ...(input.keepNewest !== undefined ? { keepNewest: input.keepNewest } : {}),
              ...(input.rescueFirst !== undefined ? { rescueFirst: input.rescueFirst } : {}),
            }),
          catch: fail,
        });
        break;
      case "open-archive":
        yield* Effect.tryPromise({ try: () => engine.openArchive(input.operationId), catch: fail });
        break;
    }
    return yield* state;
  });

  return StorageTidy.of({ state, act });
});
export const layer = Layer.effect(StorageTidy, make);
