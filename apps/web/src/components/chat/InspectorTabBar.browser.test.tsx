import { testUiLocale } from "../../../test/uiLocale";
import "~/index.css";
import { describe, expect, it } from "vite-plus/test";
import { render } from "../../../test/render";
import {
  INSPECTOR_TAB_STORAGE_KEY,
  resolveInspectorTab,
  useInspectorTab,
} from "../../inspectorTabs";
import { InspectorTabBar } from "./InspectorTabBar";

const LABELS = {
  artifacts: "产物 3",
  history: "续聊",
  subtasks: "子任务",
  project: "项目",
} as const;

function Harness({ available }: { available: Parameters<typeof resolveInspectorTab>[1] }) {
  const [stored, setStored] = useInspectorTab();
  const tab = resolveInspectorTab(stored, available);
  return (
    <>
      <InspectorTabBar tabs={available} labels={LABELS} value={tab} onChange={setStored} />
      <p data-testid="body">{tab}</p>
    </>
  );
}

const pressed = (container: Element) =>
  [...container.querySelectorAll<HTMLButtonElement>("[aria-label=检查器] button")]
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent);

describe("inspector tabs", () => {
  it("switches tabs and remembers the last one for the next mount", async () => {
    using _locale = testUiLocale("zh-CN");
    localStorage.removeItem(INSPECTOR_TAB_STORAGE_KEY);
    {
      await using screen = await render(
        <Harness available={["artifacts", "history", "subtasks", "project"]} />,
        {
          // Pure component test: nothing here navigates.
          router: false,
        },
      );
      expect(pressed(screen.container)).toEqual(["产物 3"]);
      [...screen.container.querySelectorAll<HTMLButtonElement>("[aria-label=检查器] button")]
        .find((button) => button.textContent === "续聊")!
        .click();
      await expect.poll(() => pressed(screen.container)).toEqual(["续聊"]);
      expect(screen.container.querySelector("[data-testid=body]")!.textContent).toBe("history");
    }
    expect(localStorage.getItem(INSPECTOR_TAB_STORAGE_KEY)).toBe("history");
    await using again = await render(
      <Harness available={["artifacts", "history", "subtasks", "project"]} />,
      {
        router: false,
      },
    );
    expect(pressed(again.container)).toEqual(["续聊"]);
  });

  it("falls back to an available tab when the remembered one does not exist (drafts)", async () => {
    localStorage.setItem(INSPECTOR_TAB_STORAGE_KEY, "history");
    await using screen = await render(<Harness available={["project"]} />, { router: false });
    expect(screen.container.querySelector("[data-testid=body]")!.textContent).toBe("project");
    localStorage.removeItem(INSPECTOR_TAB_STORAGE_KEY);
  });
});

it("opens the run tab without removing existing inspector entries", async () => {
  using _locale = testUiLocale("zh-CN");
  localStorage.removeItem(INSPECTOR_TAB_STORAGE_KEY);
  await using screen = await render(
    <Harness available={["artifacts", "history", "subtasks", "project"]} />,
  );
  const run = [
    ...screen.container.querySelectorAll<HTMLButtonElement>("[aria-label=检查器] button"),
  ].find((button) => button.textContent === "子任务")!;
  run.dispatchEvent(new KeyboardEvent("keydown", { key: "r", altKey: true, bubbles: true }));
  await expect.poll(() => pressed(screen.container)).toEqual(["子任务"]);
  expect(screen.container.querySelector("[data-testid=body]")!.textContent).toBe("subtasks");
  expect(screen.container.querySelectorAll("[aria-label=检查器] button")).toHaveLength(4);
  localStorage.removeItem(INSPECTOR_TAB_STORAGE_KEY);
});

it("keeps the shared spring slider node when switching tabs", async () => {
  localStorage.removeItem(INSPECTOR_TAB_STORAGE_KEY);
  await using screen = await render(
    <Harness available={["artifacts", "history", "subtasks", "project"]} />,
    { router: false },
  ); // Tab changes stay in the component.
  const slider = screen.container.querySelector("[data-inspector-tab-slider]")!;
  const style = getComputedStyle(slider);
  expect(style.transitionDuration).toBe("0.42s");
  expect(style.transitionTimingFunction).toBe("cubic-bezier(0.3, 1.35, 0.45, 1)");
  await screen.getByRole("button", { name: "子任务", exact: true }).click();
  expect(screen.container.querySelector("[data-inspector-tab-slider]")).toBe(slider);
  expect(
    screen.container
      .querySelector<HTMLElement>("[data-inspector-tabs]")!
      .style.getPropertyValue("--inspector-tab-index"),
  ).toBe("2");
  localStorage.removeItem(INSPECTOR_TAB_STORAGE_KEY);
});
