import { testUiLocale } from "../../../test/uiLocale";
import type { StorageInspection } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";
import { render } from "../../../test/render";
import { applyThemePalette } from "../../themePalette";
import { CleanupRecords } from "./CleanupRecords";
import { GIB } from "./cleanupModel";
import "~/index.css";
import "./usagePresentation.css";

const data: StorageInspection = {
  checkedAt: "2026-11-16T00:00:00Z",
  entries: [],
  volumes: [],
  archives: Array.from({ length: 8 }, (_, index) => ({
    id: `a${index}`,
    name: `archive-${index}.tar.zst with a fairly long descriptive name for overflow`,
    path: `/Volumes/External/T3-archives/very/long/path/archive-${index}.tar.zst`,
    source: "/Users/someone/Library/Application Support/Something",
    online: true,
    bytes: (index + 1) * GIB,
    restorable: index % 2 === 0,
  })),
  operations: [
    {
      id: "op1",
      type: "archive",
      phase: "completed",
      createdAt: "2026-11-15T08:00:00Z",
      sourceBytes: GIB,
      destination: "/Volumes/External/T3-archives",
    },
  ],
};

it("shows the five largest archives, expands on demand, and stays inside its card", async () => {
  using _locale = testUiLocale("zh-CN");
  const root = document.documentElement,
    theme = root.getAttribute("data-theme-id"),
    style = root.getAttribute("style");
  try {
    applyThemePalette("apple", "dark");
    await using screen = await render(
      <div data-usage-page style={{ width: 900 }}>
        <CleanupRecords data={data} />
      </div>,
    );
    const card = screen.container.querySelector(".usage-clean-records")!;
    const rows = () => card.querySelectorAll("tbody tr:not(.usage-records-detail)");
    expect(rows()).toHaveLength(5);
    expect(rows()[0]!.textContent).toContain("archive-7");
    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
    for (const row of rows()) expect(row.getBoundingClientRect().height).toBeLessThan(48);

    const more = card.querySelector<HTMLButtonElement>(".usage-records-more")!;
    expect(more.textContent).toContain("显示全部 8 项");
    more.click();
    await expect.poll(() => rows().length).toBe(8);
    const scroll = card.querySelector(".usage-records-scroll")!;
    expect(scroll.getBoundingClientRect().height).toBeLessThanOrEqual(361);

    (rows()[0] as HTMLElement).click();
    await expect
      .poll(() => card.querySelector(".usage-records-detail")?.textContent)
      .toContain("archive-7.tar.zst");

    card.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]!.click();
    await expect.poll(() => rows().length).toBe(1);
    expect(rows()[0]!.textContent).toContain("已完成");
  } finally {
    if (theme === null) root.removeAttribute("data-theme-id");
    else root.setAttribute("data-theme-id", theme);
    if (style === null) root.removeAttribute("style");
    else root.setAttribute("style", style);
  }
});
