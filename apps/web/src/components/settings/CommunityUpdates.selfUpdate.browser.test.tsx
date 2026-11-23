import { testUiLocale } from "../../../test/uiLocale";
import "~/index.css";
import type { DesktopBridge, DesktopUpdateState } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { render } from "../../../test/render";
import { CommunityUpdateSettings } from "./CommunityUpdates";
import { useCommunityUpdates } from "../../state/communityUpdates";

const offered: DesktopUpdateState = {
  enabled: true,
  status: "available",
  channel: "latest",
  currentVersion: "1.2.1",
  hostArch: "arm64",
  appArch: "arm64",
  runningUnderArm64Translation: false,
  availableVersion: "1.2.2",
  downloadedVersion: null,
  releaseNotes: [],
  omittedReleaseCount: 0,
  downloadPercent: null,
  checkedAt: null,
  message: null,
  errorContext: null,
  canRetry: true,
};

function installDesktopBridge(bridge: unknown): Disposable {
  (window as { desktopBridge?: unknown }).desktopBridge = bridge;
  return {
    [Symbol.dispose]: () => {
      delete (window as { desktopBridge?: DesktopBridge }).desktopBridge;
    },
  };
}

it("offers one-click update and restart when the Mac app can update itself", async () => {
  using _locale = testUiLocale("zh-CN");
  let state = offered;
  const listeners = new Set<(next: DesktopUpdateState) => void>();
  const calls: string[] = [];
  const bridge = {
    getUpdateState: vi.fn(async () => state),
    onUpdateState: vi.fn((listener: (next: DesktopUpdateState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    checkForUpdate: vi.fn(async () => ({ checked: true, state })),
    downloadUpdate: vi.fn(async () => {
      calls.push("download");
      state = { ...state, status: "downloaded", downloadedVersion: "1.2.2", downloadPercent: 100 };
      for (const listener of listeners) listener(state);
      return { accepted: true, completed: true, state };
    }),
    installUpdate: vi.fn(async (version?: string) => {
      calls.push(`install ${version}`);
      return { accepted: true, completed: false, state };
    }),
    setUpdateAutoInstall: vi.fn(async () => state),
    openExternal: vi.fn(async () => true),
  };
  using _bridge = installDesktopBridge(bridge);
  useCommunityUpdates.setState({
    mode: "standard",
    automatic: false,
    autoInstall: false,
    status: "idle",
    release: null,
    error: null,
    lastAttempt: 0,
  });

  await using screen = await render(<CommunityUpdateSettings />);
  await expect.element(screen.getByText("当前 v1.2.1 · 新版本 v1.2.2")).toBeVisible();
  await expect
    .element(screen.getByRole("switch", { name: "自动下载更新，下次启动时安装" }))
    .not.toBeChecked();
  await expect.element(screen.getByRole("button", { name: "查看更新说明" })).toBeVisible();
  expect(document.body.textContent).not.toContain("前往下载页");

  await screen.getByRole("button", { name: "更新并重启" }).click();
  await vi.waitFor(() => expect(calls).toEqual(["download", "install 1.2.2"]));
});
