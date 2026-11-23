import { testUiLocale } from "../../../test/uiLocale";
import { expect, it } from "vite-plus/test";
import { render } from "../../../test/render";
import { applyThemePalette } from "../../themePalette";
import { CleanupDashboard } from "./CleanupDashboard";
import { GIB } from "./cleanupModel";
import "~/index.css";
import "./usagePresentation.css";
it("represents 418.4/460GiB used as 91 percent of the bar, with free space on the right", async () => {
  const root = document.documentElement,
    theme = root.getAttribute("data-theme-id"),
    style = root.getAttribute("style");
  try {
    applyThemePalette("apple", "light");
    await using screen = await render(
      <CleanupDashboard
        data={{
          checkedAt: "2026-11-16T00:00:00Z",
          entries: [
            {
              id: "cache",
              name: "Cache",
              path: "/cache",
              kind: "cache",
              reason: "Sample",
              bytes: 2 * GIB,
              canRelease: true,
            },
          ],
          archives: [],
          operations: [],
          volumes: [
            {
              id: "disk",
              name: "Sample disk",
              path: "/",
              freeBytes: 41.6 * GIB,
              totalBytes: 460 * GIB,
            },
          ],
        }}
        releaseBytes={0}
        volumePath="/"
        onVolumeChange={() => {}}
      />,
    );
    const track = screen.container.querySelector(".usage-capacity-track")!,
      occupied = screen.container.querySelector(".usage-capacity-segments")!;
    expect(
      occupied.getBoundingClientRect().width / track.getBoundingClientRect().width,
    ).toBeCloseTo(418.4 / 460, 2);
    const sum = [...occupied.children].reduce((n, e) => n + e.getBoundingClientRect().width, 0);
    expect(sum / track.getBoundingClientRect().width).toBeCloseTo(418.4 / 460, 2);
    expect(screen.container.querySelector('[data-tone="free"]')).not.toBeNull();
  } finally {
    if (theme === null) root.removeAttribute("data-theme-id");
    else root.setAttribute("data-theme-id", theme);
    if (style === null) root.removeAttribute("style");
    else root.setAttribute("style", style);
  }
});

it("keeps unscanned categories unknown until measured bytes arrive", async () => {
  using _locale = testUiLocale("zh-CN");
  const data = {
    checkedAt: "2026-11-16T00:00:00Z",
    entries: [],
    archives: [],
    operations: [],
    volumes: [{ id: "disk", name: "Disk", path: "/", freeBytes: 50 * GIB, totalBytes: 460 * GIB }],
  };
  await using screen = await render(
    <CleanupDashboard data={data} releaseBytes={0} volumePath="/" onVolumeChange={() => {}} />,
  );
  expect(screen.container.querySelectorAll(".usage-capacity-legend b")[0]?.textContent).toBe(
    "待扫描 / 未知",
  );
  expect(
    [...screen.container.querySelectorAll(".usage-tag")].map((node) => node.textContent),
  ).not.toContain("实测");
  await screen.rerender(
    <CleanupDashboard
      data={{
        ...data,
        entries: [
          {
            id: "cache",
            name: "Cache",
            path: "/cache",
            kind: "cache",
            reason: "Measured",
            bytes: 0,
            canRelease: true,
          },
        ],
      }}
      releaseBytes={0}
      volumePath="/"
      onVolumeChange={() => {}}
    />,
  );
  expect(screen.container.querySelectorAll(".usage-capacity-legend b")[0]?.textContent).toBe(
    "0.0 GiB",
  );
  expect(
    [...screen.container.querySelectorAll(".usage-tag")].map((node) => node.textContent),
  ).toContain("实测");
});
