// @effect-diagnostics nodeBuiltinImport:off -- Spawns the detached installer and runs macOS tools.
/**
 * StardustMacUpdater for packaged T3 Stardust builds on macOS, electron-updater elsewhere
 * (which stays off without an app-update.yml).
 *
 * @module ElectronUpdaterSelection
 */
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Electron from "electron";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeChildProcess from "node:child_process";
import * as NodeOS from "node:os";

import { appBundleOfResourcesPath } from "../updates/stardustUpdate.ts";
import * as ElectronUpdater from "./ElectronUpdater.ts";
import * as StardustMacUpdater from "./StardustMacUpdater.ts";

function execFile(file: string, args: ReadonlyArray<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    NodeChildProcess.execFile(
      file,
      [...args],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60 * 1000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${file} failed: ${String(stderr || error.message).slice(0, 400)}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function spawnDetached(file: string, args: ReadonlyArray<string>): void {
  const child = NodeChildProcess.spawn(file, [...args], {
    detached: true,
    stdio: "ignore",
    env: {
      HOME: process.env.HOME ?? NodeOS.homedir(),
      USER: process.env.USER ?? "",
      LOGNAME: process.env.LOGNAME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    },
  });
  child.unref();
}

export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const platform = yield* HostProcess.Platform;
    const resourcesPath = process.resourcesPath;
    const buildInfo = StardustMacUpdater.readStardustBuildInfo({
      platform,
      isPackaged: Electron.app.isPackaged,
      resourcesPath,
    });
    const currentAppPath = buildInfo ? appBundleOfResourcesPath(resourcesPath) : null;
    if (!buildInfo || !currentAppPath) return ElectronUpdater.layer;
    return StardustMacUpdater.layer({
      buildInfo,
      currentAppPath,
      homeDirectory: NodeOS.homedir(),
      pid: process.pid,
      // Electron's net stack follows the system proxy, which many users need to reach GitHub.
      fetch: (url, init) => Electron.net.fetch(url, { headers: init.headers, signal: init.signal }),
      execFile,
      spawnDetached,
      quitApp: () => Electron.app.quit(),
      onWillQuit: (listener) => {
        Electron.app.on("will-quit", listener);
        return () => {
          Electron.app.removeListener("will-quit", listener);
        };
      },
    });
  }),
);
