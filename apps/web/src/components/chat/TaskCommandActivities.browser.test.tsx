import { GTProvider } from "gt-react";
import zh from "../../i18n/translations/zh.json";
import { expect, it } from "vite-plus/test";
import { render } from "../../../test/render";
import { TaskCommandActivities } from "./TaskCommandActivities";
import type { TrailActivity } from "./taskTrailModel";
import "~/index.css";
it("retains earlier failures and exposes selectable original commands only on expansion", async () => {
  const activities: TrailActivity[] = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    kind: "command",
    label: i === 0 ? "运行测试" : "读取",
    command: i === 0 ? "pnpm test" : `cat /tmp/${i}.txt`,
    ...(i > 0 ? { path: `/tmp/${i}.txt` } : {}),
    status: i === 0 ? "failed" : i === 6 ? "no_matches" : i === 7 ? "running" : "completed",
  }));
  await using screen = await render(
    <GTProvider locale="zh" translations={{ zh, en: {} } as never}>
      <TaskCommandActivities activities={activities} onOpenFile={undefined} />
    </GTProvider>,
  );
  await expect.element(screen.getByText("失败", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("还有 3 条")).toBeVisible();
  expect(screen.container.querySelectorAll(".task-command-row")).toHaveLength(5);
  const failed = screen.container.querySelector('.task-command-row[data-status="failed"]')!;
  expect(getComputedStyle(failed.querySelector(".task-command-label")!).color).toBe(
    getComputedStyle(failed.querySelector(".task-command-status")!).color,
  );
  const noMatches = screen.container.querySelector('.task-command-row[data-status="no_matches"]')!;
  expect(noMatches.querySelector(".task-command-status")?.textContent).toBe("无结果");
  expect(getComputedStyle(noMatches.querySelector(".task-command-status")!).color).not.toBe(
    getComputedStyle(failed.querySelector(".task-command-status")!).color,
  );
  const toggle = screen.getByRole("button", { name: "查看命令（8 条）" });
  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await expect.element(screen.getByText("pnpm test", { exact: true })).toBeVisible();
  const raw = screen.container.querySelector("pre")!;
  expect(getComputedStyle(raw).userSelect).toBe("text");
  expect(getComputedStyle(raw).fontFamily).toContain("monospace");
  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.container.querySelector(".task-command-raw")?.hasAttribute("inert")).toBe(true);
});
