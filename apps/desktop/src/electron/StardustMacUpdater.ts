// @effect-diagnostics nodeBuiltinImport:off -- Streams a large download and spawns a detached installer.
// @effect-diagnostics globalTimers:off -- The download idle timeout aborts a fetch outside the Effect runtime.
/**
 * The ElectronUpdater service for ad-hoc signed T3 Stardust builds on macOS. It emits the events
 * electron-updater does, so DesktopUpdates and the existing update UI drive it unchanged.
 *
 * @module StardustMacUpdater
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeEvents from "node:events";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  STARDUST_BUILD_INFO_FILE,
  STARDUST_LATEST_RELEASE_API,
  StardustUpdateError,
  buildStardustInstallScript,
  isStardustUpgrade,
  isTranslocatedAppPath,
  normalizeStardustVersion,
  parseStardustBuildInfo,
  parseStardustRelease,
  verifyFileSha256,
  type StardustBuildInfo,
  type StardustRelease,
} from "../updates/stardustUpdate.ts";
import {
  ElectronUpdater,
  ElectronUpdaterCheckForUpdatesError,
  ElectronUpdaterDownloadUpdateError,
  ElectronUpdaterQuitAndInstallError,
} from "./ElectronUpdater.ts";

const CHANNEL = "stardust";
const METADATA_TIMEOUT_MS = 20_000;
const DOWNLOAD_IDLE_TIMEOUT_MS = 60_000;

export interface StardustFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  readonly body: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
}

export interface StardustMacUpdaterDeps {
  readonly buildInfo: StardustBuildInfo;
  /** The running bundle, e.g. /Applications/T3 Stardust.app. */
  readonly currentAppPath: string;
  readonly homeDirectory: string;
  readonly pid: number;
  readonly fetch: (
    url: string,
    init: { readonly headers: Record<string, string>; readonly signal: AbortSignal },
  ) => Promise<StardustFetchResponse>;
  /** Runs a system tool (ditto, plutil, codesign, xattr) and resolves with its stdout. */
  readonly execFile: (file: string, args: ReadonlyArray<string>) => Promise<string>;
  /** Starts a process that outlives the app. */
  readonly spawnDetached: (file: string, args: ReadonlyArray<string>) => void;
  readonly quitApp: () => void;
  /** Registers a synchronous last-chance hook on app quit; returns its removal. */
  readonly onWillQuit: (listener: () => void) => () => void;
  readonly now?: () => number;
}

export interface StardustUpdatePaths {
  readonly cacheRoot: string;
  readonly backupRoot: string;
  readonly logPath: string;
}

export function stardustUpdatePaths(homeDirectory: string): StardustUpdatePaths {
  const library = NodePath.join(homeDirectory, "Library");
  return {
    cacheRoot: NodePath.join(library, "Caches", "T3 Stardust", "updates"),
    backupRoot: NodePath.join(library, "Application Support", "T3 Stardust", "update-backup"),
    logPath: NodePath.join(library, "Logs", "T3 Stardust", "update.log"),
  };
}

interface PreparedUpdate {
  readonly release: StardustRelease;
  readonly appPath: string;
  readonly versionDir: string;
}

/** Fails unless the app can replace itself without elevated rights. */
export function assertReplaceableAppLocation(appPath: string): void {
  if (isTranslocatedAppPath(appPath)) throw new StardustUpdateError("translocated", appPath);
  try {
    NodeFS.accessSync(NodePath.dirname(appPath), NodeFS.constants.W_OK);
    NodeFS.accessSync(appPath, NodeFS.constants.W_OK);
  } catch (cause) {
    throw new StardustUpdateError(
      "not-writable",
      `${NodePath.dirname(appPath)}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

async function readBundleIdentifier(
  execFile: StardustMacUpdaterDeps["execFile"],
  appPath: string,
): Promise<string> {
  const output = await execFile("/usr/bin/plutil", [
    "-extract",
    "CFBundleIdentifier",
    "raw",
    "-o",
    "-",
    NodePath.join(appPath, "Contents", "Info.plist"),
  ]);
  return output.trim();
}

async function readBundleCommunityVersion(
  execFile: StardustMacUpdaterDeps["execFile"],
  appPath: string,
): Promise<string | null> {
  try {
    const raw = await NodeFS.promises.readFile(
      NodePath.join(appPath, "Contents", "Resources", STARDUST_BUILD_INFO_FILE),
      "utf8",
    );
    const info = parseStardustBuildInfo(raw);
    if (info) return info.communityVersion;
  } catch {}
  try {
    const shortVersion = await execFile("/usr/bin/plutil", [
      "-extract",
      "CFBundleShortVersionString",
      "raw",
      "-o",
      "-",
      NodePath.join(appPath, "Contents", "Info.plist"),
    ]);
    return normalizeStardustVersion(shortVersion.trim());
  } catch {
    return null;
  }
}

/**
 * Extracts and checks a verified zip: one .app, the running app's bundle id, the release's
 * version, a valid code signature, and no quarantine flag. Returns the extracted bundle.
 */
export async function prepareStardustUpdate(options: {
  readonly zipPath: string;
  readonly extractDir: string;
  readonly expectedBundleId: string;
  readonly expectedVersion: string;
  readonly execFile: StardustMacUpdaterDeps["execFile"];
}): Promise<string> {
  const { execFile } = options;
  await NodeFS.promises.rm(options.extractDir, { recursive: true, force: true });
  await NodeFS.promises.mkdir(options.extractDir, { recursive: true });
  try {
    await execFile("/usr/bin/ditto", ["-x", "-k", options.zipPath, options.extractDir]);
  } catch (cause) {
    throw new StardustUpdateError("extract-failed", describe(cause));
  }
  const apps = (await NodeFS.promises.readdir(options.extractDir, { withFileTypes: true })).filter(
    (entry) => entry.isDirectory() && entry.name.endsWith(".app"),
  );
  if (apps.length !== 1) {
    throw new StardustUpdateError("extract-failed", `expected one .app, found ${apps.length}`);
  }
  const appPath = NodePath.join(options.extractDir, apps[0]!.name);

  let bundleId: string;
  try {
    bundleId = await readBundleIdentifier(execFile, appPath);
  } catch (cause) {
    throw new StardustUpdateError("bundle-mismatch", describe(cause));
  }
  if (bundleId !== options.expectedBundleId) {
    throw new StardustUpdateError(
      "bundle-mismatch",
      `expected ${options.expectedBundleId}, got ${bundleId}`,
    );
  }

  const version = await readBundleCommunityVersion(execFile, appPath);
  if (version !== options.expectedVersion) {
    throw new StardustUpdateError(
      "version-mismatch",
      `expected ${options.expectedVersion}, got ${version ?? "unknown"}`,
    );
  }

  try {
    await execFile("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath]);
  } catch (cause) {
    throw new StardustUpdateError("signature-invalid", describe(cause));
  }
  // xattr exits non-zero when nothing carried the flag; the check below is what matters.
  await execFile("/usr/bin/xattr", ["-dr", "com.apple.quarantine", appPath]).catch(() => "");
  const stillQuarantined = await execFile("/usr/bin/xattr", [
    "-p",
    "com.apple.quarantine",
    appPath,
  ]).then(
    () => true,
    () => false,
  );
  if (stillQuarantined) {
    throw new StardustUpdateError("extract-failed", "could not clear com.apple.quarantine");
  }
  return appPath;
}

function describe(cause: unknown): string {
  return (cause instanceof Error ? cause.message : String(cause)).slice(0, 500);
}

async function downloadToFile(options: {
  readonly fetch: StardustMacUpdaterDeps["fetch"];
  readonly url: string;
  readonly filePath: string;
  readonly expectedSize: number;
  readonly onProgress: (progress: {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
  }) => void;
  readonly now: () => number;
}): Promise<void> {
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armIdleTimer = () => {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), DOWNLOAD_IDLE_TIMEOUT_MS);
  };
  armIdleTimer();
  const output = NodeFS.createWriteStream(options.filePath);
  const closed = new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
  });
  try {
    let response: StardustFetchResponse;
    try {
      response = await options.fetch(options.url, {
        headers: { Accept: "application/octet-stream" },
        signal: controller.signal,
      });
    } catch (cause) {
      throw new StardustUpdateError("network", describe(cause));
    }
    if (!response.ok || !response.body) {
      throw new StardustUpdateError("network", `download HTTP ${response.status}`);
    }
    const total = options.expectedSize;
    const startedAt = options.now();
    let transferred = 0;
    const reader = response.body.getReader();
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (cause) {
        throw new StardustUpdateError("network", describe(cause));
      }
      if (chunk.done) break;
      armIdleTimer();
      transferred += chunk.value.byteLength;
      if (transferred > total) {
        throw new StardustUpdateError(
          "digest-mismatch",
          "download is larger than the release asset",
        );
      }
      if (!output.write(chunk.value)) {
        await new Promise<void>((resolve) => output.once("drain", resolve));
      }
      const elapsedSeconds = Math.max(0.001, (options.now() - startedAt) / 1000);
      options.onProgress({
        percent: (transferred / total) * 100,
        transferred,
        total,
        bytesPerSecond: Math.round(transferred / elapsedSeconds),
      });
    }
    if (transferred !== total) {
      throw new StardustUpdateError(
        "network",
        `download ended at ${transferred} of ${total} bytes`,
      );
    }
  } finally {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    output.end();
    await closed;
  }
}

/** @public */
export function makeStardustMacUpdater(deps: StardustMacUpdaterDeps) {
  const events = new NodeEvents.EventEmitter();
  const paths = stardustUpdatePaths(deps.homeDirectory);
  const now = deps.now ?? Date.now;
  const runningVersion = deps.buildInfo.communityVersion;
  let latest: StardustRelease | null = null;
  let prepared: PreparedUpdate | null = null;
  let autoInstallOnAppQuit = false;
  let installerStarted = false;

  const updateInfo = (release: StardustRelease) => ({
    version: release.version,
    releaseName: release.releaseName ?? release.tag,
    releaseNotes: release.releaseNotes ?? undefined,
    ...(release.releaseDate ? { releaseDate: release.releaseDate } : {}),
  });

  const check = async (): Promise<void> => {
    events.emit("checking-for-update");
    let response: StardustFetchResponse;
    try {
      response = await deps.fetch(STARDUST_LATEST_RELEASE_API, {
        headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new StardustUpdateError("network", describe(cause));
    }
    if (!response.ok) {
      throw new StardustUpdateError(
        response.status === 403 || response.status === 429 ? "rate-limited" : "network",
        `releases/latest HTTP ${response.status}`,
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new StardustUpdateError("invalid-release", describe(cause));
    }
    const release = parseStardustRelease(body);
    // Never offer an equal or older release, also to local builds that already ship newer code.
    if (!isStardustUpgrade(release.version, runningVersion)) {
      latest = null;
      events.emit("update-not-available", { version: release.version });
      return;
    }
    latest = release;
    events.emit("update-available", updateInfo(release));
  };

  const download = async (): Promise<void> => {
    const release = latest;
    if (!release)
      throw new StardustUpdateError("no-download", "no release found by the last check");
    if (prepared && prepared.release.version === release.version) {
      events.emit("update-downloaded", updateInfo(release));
      return;
    }
    // Refuse early instead of after a 200 MB download.
    assertReplaceableAppLocation(deps.currentAppPath);
    const expectedBundleId = await readBundleIdentifier(deps.execFile, deps.currentAppPath);

    await NodeFS.promises.mkdir(paths.cacheRoot, { recursive: true });
    const versionDir = NodePath.join(paths.cacheRoot, release.version);
    // Drop earlier downloads; only the release being fetched is kept.
    for (const entry of await NodeFS.promises.readdir(paths.cacheRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== release.version) {
        await NodeFS.promises.rm(NodePath.join(paths.cacheRoot, entry.name), {
          recursive: true,
          force: true,
        });
      }
    }
    await NodeFS.promises.rm(versionDir, { recursive: true, force: true });
    await NodeFS.promises.mkdir(versionDir, { recursive: true });
    const zipPath = NodePath.join(versionDir, release.asset.name);
    const partialPath = `${zipPath}.part`;
    await downloadToFile({
      fetch: deps.fetch,
      url: release.asset.url,
      filePath: partialPath,
      expectedSize: release.asset.size,
      now,
      onProgress: (progress) => events.emit("download-progress", progress),
    });
    try {
      await verifyFileSha256(partialPath, release.asset.sha256);
    } catch (error) {
      await NodeFS.promises.rm(versionDir, { recursive: true, force: true });
      throw error;
    }
    await NodeFS.promises.rename(partialPath, zipPath);
    const appPath = await prepareStardustUpdate({
      zipPath,
      extractDir: NodePath.join(versionDir, "app"),
      expectedBundleId,
      expectedVersion: release.version,
      execFile: deps.execFile,
    }).catch(async (error: unknown) => {
      await NodeFS.promises.rm(versionDir, { recursive: true, force: true });
      throw error;
    });
    // The zip is no longer needed once the bundle checks out.
    await NodeFS.promises.rm(zipPath, { force: true });
    prepared = { release, appPath, versionDir };
    events.emit("update-downloaded", updateInfo(release));
  };

  const startInstaller = (relaunch: boolean): void => {
    const update = prepared;
    if (!update || !NodeFS.existsSync(update.appPath)) {
      throw new StardustUpdateError("no-download");
    }
    assertReplaceableAppLocation(deps.currentAppPath);
    const script = buildStardustInstallScript({
      pid: deps.pid,
      currentAppPath: deps.currentAppPath,
      newAppPath: update.appPath,
      backupDir: NodePath.join(paths.backupRoot, runningVersion),
      logPath: paths.logPath,
      cleanupDir: update.versionDir,
      fromVersion: runningVersion,
      toVersion: update.release.version,
      relaunch,
    });
    const scriptPath = NodePath.join(paths.cacheRoot, `install-${update.release.version}.zsh`);
    try {
      NodeFS.mkdirSync(NodePath.dirname(paths.logPath), { recursive: true });
      NodeFS.writeFileSync(scriptPath, script, { mode: 0o700 });
      deps.spawnDetached("/bin/zsh", [scriptPath]);
    } catch (cause) {
      throw new StardustUpdateError("install-failed", describe(cause));
    }
    installerStarted = true;
  };

  const removeWillQuit = deps.onWillQuit(() => {
    if (!autoInstallOnAppQuit || installerStarted || !prepared) return;
    try {
      // The user quit on purpose, so the new version waits for their next launch.
      startInstaller(false);
    } catch {
      // Nothing to report at quit; the download stays and the next session offers it again.
    }
  });

  const ignored = (name: string) =>
    Effect.fn(`StardustMacUpdater.${name}`)(function (_value: unknown) {
      return Effect.void;
    });
  const service = ElectronUpdater.of({
    setFeedURL: ignored("setFeedURL"),
    setAutoDownload: ignored("setAutoDownload"),
    setAutoInstallOnAppQuit: Effect.fn("StardustMacUpdater.setAutoInstallOnAppQuit")(
      function (value) {
        return Effect.sync(() => {
          autoInstallOnAppQuit = value;
        });
      },
    ),
    setChannel: ignored("setChannel"),
    setAllowPrerelease: ignored("setAllowPrerelease"),
    // Downgrades are never allowed: an older build can lack migrations this one ran.
    allowDowngrade: Effect.succeed(false),
    setAllowDowngrade: ignored("setAllowDowngrade"),
    setFullChangelog: ignored("setFullChangelog"),
    setDisableDifferentialDownload: ignored("setDisableDifferentialDownload"),
    checkForUpdates: Effect.tryPromise({
      try: check,
      catch: (cause) => new ElectronUpdaterCheckForUpdatesError({ channel: CHANNEL, cause }),
    }),
    downloadUpdate: Effect.tryPromise({
      try: download,
      catch: (cause) => new ElectronUpdaterDownloadUpdateError({ channel: CHANNEL, cause }),
    }),
    quitAndInstall: Effect.fn("StardustMacUpdater.quitAndInstall")(function ({
      isSilent,
      isForceRunAfter,
    }) {
      return Effect.try({
        try: () => {
          startInstaller(true);
          deps.quitApp();
        },
        catch: (cause) =>
          new ElectronUpdaterQuitAndInstallError({
            channel: CHANNEL,
            isSilent,
            isForceRunAfter,
            cause,
          }),
      });
    }),
    on: Effect.fn("StardustMacUpdater.on")(function (eventName, listener) {
      const untyped = listener as unknown as (...args: Array<unknown>) => void;
      return Effect.acquireRelease(
        Effect.sync(() => {
          events.on(eventName, untyped);
        }),
        () =>
          Effect.sync(() => {
            events.removeListener(eventName, untyped);
          }),
      ).pipe(Effect.asVoid);
    }),
    stardustFeed: {
      runningVersion,
      customBuild: deps.buildInfo.customBuild,
    },
  });
  return { service, dispose: removeWillQuit };
}

/** The Stardust build info of a packaged macOS app, or null for every other build. */
export function readStardustBuildInfo(options: {
  readonly platform: NodeJS.Platform;
  readonly isPackaged: boolean;
  readonly resourcesPath: string;
}): StardustBuildInfo | null {
  if (options.platform !== "darwin" || !options.isPackaged) return null;
  try {
    return parseStardustBuildInfo(
      NodeFS.readFileSync(NodePath.join(options.resourcesPath, STARDUST_BUILD_INFO_FILE), "utf8"),
    );
  } catch {
    return null;
  }
}

export const layer = (deps: StardustMacUpdaterDeps) =>
  Layer.effect(
    ElectronUpdater,
    Effect.acquireRelease(
      Effect.sync(() => makeStardustMacUpdater(deps)),
      ({ dispose }) => Effect.sync(dispose),
    ).pipe(Effect.map(({ service }) => service)),
  );
