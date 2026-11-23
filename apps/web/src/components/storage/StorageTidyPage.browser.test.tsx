import { EnvironmentId, type StorageTidyActionInput, type StorageTidyState } from "@t3tools/contracts";
import { page } from "vite-plus/test/browser";
import { expect, it, vi } from "vite-plus/test";

import { testUiLocale } from "../../../test/uiLocale";
import { render } from "../../../test/render";
import "~/index.css";
import { UsageDiskChip } from "../usage/UsageDiskChip";
import { fixtureResultState, fixtureState } from "./storageTidy.fixture";

const hoisted = vi.hoisted(() => ({ idle: undefined as unknown, run: undefined as unknown }));

vi.mock(import("~/i18n/useUiText"), async () => {
  const { uiText } = await import("~/i18n");
  return {
    useUiText: () => (source: string, values?: Readonly<Record<string, unknown>>) =>
      uiText(source, values, "zh-CN"),
  };
});
vi.mock(import("~/state/server"), async (original) => {
  const { AsyncResult, Atom } = await import("effect/reactivity");
  const actual = await original();
  const { fixtureState: initial } = await import("./storageTidy.fixture");
  const queried = Atom.make(AsyncResult.success(initial));
  hoisted.idle = initial;
  return {
    ...actual,
    serverEnvironment: {
      ...actual.serverEnvironment,
      storageTidyState: (() => queried) as never,
      storageTidyAct: { ...actual.serverEnvironment.storageTidyAct, permissionAtom: () => Atom.make(true) } as never,
    },
  };
});
vi.mock(import("~/state/use-atom-command"), async (original) => ({
  ...(await original()),
  useAtomCommand: (() => (value: unknown) => (hoisted.run as (v: unknown) => unknown)(value)) as never,
}));

import { StorageTidyEnvironment } from "./StorageTidyPage";

const ENVIRONMENT = EnvironmentId.make("workstation");

it("scan → results → clean sends only ids the user chose, never reminders", async () => {
  using _locale = testUiLocale("zh-CN");
  const calls: StorageTidyActionInput[] = [];
  const executing: StorageTidyState = { ...fixtureResultState, phase: "executing" };
  hoisted.run = async ({ input }: { input: StorageTidyActionInput }) => {
    calls.push(input);
    return { _tag: "Success", value: input.action === "scan" ? fixtureResultState : executing };
  };
  await using screen = await render(<StorageTidyEnvironment environmentId={ENVIRONMENT} />);
  await expect.element(page.getByRole("heading", { name: "存储与清理", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /^扫描/ }).click();
  expect(calls).toEqual([{ action: "scan" }]);
  await expect.element(page.getByTestId("tidy-results")).toBeVisible();

  // A 看一眼 item joins the preselected 放心清 items.
  await page.getByRole("checkbox", { name: "选择 Codex 会话记录" }).click();
  await page.getByRole("button", { name: "清理已选项" }).click();
  const execute = calls.find((call) => call.action === "execute");
  if (execute?.action !== "execute") throw new Error("execute was not sent");
  expect(execute.rescue).toBe(true);
  expect(execute.itemIds).toContain("sess-codex");
  expect(execute.itemIds).toContain("mole-developer");
  for (const forbidden of ["wt-dirty", "t3-data", "build-dirty", "wt-unmerged"])
    expect(execute.itemIds).not.toContain(forbidden);
  await expect.element(page.getByText("正在清理…").first()).toBeVisible();
  expect(screen.container.querySelector('[data-mode="executing"]')).not.toBeNull();
});

it("the usage page keeps only a small disk-free chip that links to the page", async () => {
  using _locale = testUiLocale("zh-CN");
  await using screen = await render(<UsageDiskChip environmentId={ENVIRONMENT} />);
  const chip = screen.container.querySelector<HTMLAnchorElement>('[data-testid="usage-disk-chip"]')!;
  expect(chip.textContent).toContain("磁盘剩余 40.0 GB");
  expect(chip.getAttribute("href")).toBe("/settings/storage");
  expect(fixtureState.volumes[0]?.internal).toBe(true);
});
