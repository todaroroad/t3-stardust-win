import { testUiLocale } from "../../../test/uiLocale";
import "~/index.css";
import { expect, it, vi } from "vite-plus/test";
import { render } from "../../../test/render";
import { CommunityUpdateSettings } from "./CommunityUpdates";
import { useCommunityUpdates } from "../../state/communityUpdates";
it("keeps modified workbenches on source review and only offers downloads after opting into standard mode", async () => {
  using _locale = testUiLocale("zh-CN");
  useCommunityUpdates.setState({
    mode: "custom",
    automatic: false,
    status: "idle",
    release: null,
    error: null,
    lastAttempt: 0,
  });
  const originalFetch = globalThis.fetch;
  using request = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
    String(input).includes("api.github.com/repos/zds-xiaoxin/xiaoxin-t3code/")
      ? Promise.resolve(
          new Response(
            JSON.stringify({
              tag_name: "v1.2.2",
              draft: false,
              prerelease: false,
              assets: [
                {
                  name: "T3-Stardust-1.2.2-macOS-arm64.zip",
                  state: "uploaded",
                  size: 100,
                  digest: `sha256:${"a".repeat(64)}`,
                },
              ],
            }),
            { status: 200 },
          ),
        )
      : originalFetch(input, init),
  );
  await using screen = await render(<CommunityUpdateSettings />);
  await screen.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect.element(screen.getByRole("button", { name: "查看源码差异" })).toBeVisible();
  expect(document.body.textContent).not.toContain("前往下载页");
  await screen.getByRole("combobox", { name: "社区更新模式" }).selectOptions("standard");
  await expect.element(screen.getByRole("button", { name: "前往下载页" })).toBeVisible();
  expect(document.body.textContent).not.toContain("查看源码差异");
  expect(request.mock.calls.filter(([url]) => String(url).includes("api.github.com"))).toHaveLength(
    1,
  );
});
