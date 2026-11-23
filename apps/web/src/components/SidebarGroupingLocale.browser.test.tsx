import { GTProvider } from "gt-react";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "../../test/render";
import zh from "../i18n/translations/zh.json";
import { parseSidebarGrouping } from "../sidebarProjectFirst";
import { ProjectSortMenu } from "./LegacySidebar";

it("persists the model grouping ID when the display language is Chinese", async () => {
  const select = vi.fn();
  await using screen = await render(
    <GTProvider locale="zh" translations={{ zh, en: {} } as never}>
      <ProjectSortMenu
        grouping="category"
        onGroupingChange={select}
        projectSortOrder="updated_at"
        threadSortOrder="updated_at"
        threadPreviewCount={5}
        onProjectSortOrderChange={() => {}}
        onThreadSortOrderChange={() => {}}
        onThreadPreviewCountChange={() => {}}
      />
    </GTProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /侧栏/ }));
  await userEvent.click(screen.getByRole("menuitemradio", { name: "按模型" }));
  expect(select).toHaveBeenCalledExactlyOnceWith("model");
  expect(parseSidebarGrouping(select.mock.calls[0]?.[0])).toBe("model");
});
