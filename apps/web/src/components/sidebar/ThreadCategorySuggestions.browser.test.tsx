import "~/index.css";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { ThreadCategorySuggestions } from "./ThreadCategorySuggestions";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("~/hooks/useSidebarSuggestionModels", () => ({
  useSidebarSuggestionModels: () => ({ environmentId: "fixture", models: [{}] }),
}));
vi.mock("~/state/server", async () => {
  const { Atom } = await import("effect/reactivity");
  const allowed = Atom.make(true);
  return { serverEnvironment: { suggestSidebarCategories: { permissionAtom: () => allowed } } };
});
vi.mock("~/state/use-atom-command", () => ({
  useAtomCommand: () => mocks.run,
}));

it("shares titles only and changes categories after the reviewed selection is confirmed", async () => {
  await page.viewport(1280, 800);
  const overridesKey = "t3code:thread-categories:v1";
  const bannerKey = "t3code:sidebar-category-suggestions-seen:v1";
  const previous = [localStorage.getItem(overridesKey), localStorage.getItem(bannerKey)];
  using _storage = {
    [Symbol.dispose]() {
      [overridesKey, bannerKey].forEach((key, index) => {
        const value = previous[index];
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      });
    },
  };
  localStorage.removeItem(overridesKey);
  localStorage.removeItem(bannerKey);
  const candidates = Array.from({ length: 5 }, (_, index) => ({
    key: `private-id-${index}`,
    title: `Example title ${index}`,
  }));
  mocks.run.mockReset().mockResolvedValue({
    _tag: "Success",
    value: {
      model: "local-fixture",
      suggestions: [
        { titleIndex: 0, categoryIndex: 0, reason: "First reason" },
        { titleIndex: 1, categoryIndex: 1, reason: "Second reason" },
      ],
    },
  });

  // Exercises the suggestion panel without a connection or a real model call.
  await using screen = await render(
    <ThreadCategorySuggestions
      candidates={candidates}
      categories={[
        { id: "work", label: "Work", keywords: [] },
        { id: "research", label: "Research", keywords: [] },
      ]}
      modelSelection={null}
    />,
    { router: false },
  );
  await userEvent.click(screen.getByRole("button", { name: "Help me categorize" }));
  const dialog = page.getByRole("dialog");
  await expect.element(dialog.getByText("First reason")).toBeVisible();
  expect(mocks.run).toHaveBeenCalledExactlyOnceWith({
    environmentId: "fixture",
    input: {
      titles: candidates.map((candidate) => candidate.title),
      categories: ["Work", "Research"],
      modelSelection: null,
      language: "en",
    },
  });
  expect(localStorage.getItem(overridesKey)).toBeNull();

  await userEvent.selectOptions(
    dialog.getByRole("combobox", { name: "Category for Example title 0" }),
    "research",
  );
  await userEvent.click(dialog.getByRole("checkbox", { name: "Include Example title 1" }));
  await userEvent.click(dialog.getByRole("button", { name: "Move 1 threads" }));
  expect(JSON.parse(localStorage.getItem(overridesKey) ?? "{}")).toEqual({
    "private-id-0": "research",
  });
  await expect.element(dialog).not.toBeInTheDocument();
});
