import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { MALFORMED_USAGE_WARNING_TEMPLATE, usageSourceMessages } from "@t3tools/shared/usageFormat";
import { analysisFixture } from "./usageAnalysis.fixture";
import { uiText } from "~/i18n";
vi.mock(import("~/i18n/useUiText"), async () => {
  const { uiText } = await import("~/i18n");
  return {
    useUiText: () => (source: string, values?: Readonly<Record<string, unknown>>) =>
      uiText(source, values, "zh-CN"),
  };
});
const ENVIRONMENT_ID = vi.hoisted(() => "workstation");

vi.mock(import("~/state/presentation"), async (original) => {
  const { Atom } = await import("effect/reactivity");
  const actual = await original();
  const presentation = {
    entry: { target: { label: "workstation" } },
    connection: { phase: "connected" },
    serverConfig: {
      environment: { capabilities: { usagePriceOverrides: true, usageModelAliases: true } },
    },
  };
  return {
    ...actual,
    environmentPresentations: {
      ...actual.environmentPresentations,
      presentationsAtom: Atom.make(new Map([[ENVIRONMENT_ID, presentation]])) as never,
    },
  };
});
vi.mock(import("~/state/server"), async (original) => {
  const { Atom } = await import("effect/reactivity");
  const actual = await original();
  const settings = Atom.make({ usagePriceOverrides: {}, usageModelAliases: {} });
  return {
    ...actual,
    serverEnvironment: {
      ...actual.serverEnvironment,
      settingsValueAtom: (() => settings) as never,
    },
  };
});
vi.mock(import("~/state/session"), async (original) => {
  const { AsyncResult, Atom } = await import("effect/reactivity");
  const actual = await original();
  const session = Atom.make(
    AsyncResult.success({ authenticated: true, scopes: ["settings:write"] }),
  );
  return {
    ...actual,
    environmentSession: {
      ...actual.environmentSession,
      sessionStateAtom: (() => session) as never,
    },
  };
});
vi.mock(import("~/state/use-atom-command"), async (original) => ({
  ...(await original()),
  useAtomCommand: (() => vi.fn()) as never,
}));

import { UsagePriceOverrides } from "./UsagePriceOverrides";

describe("Chinese usage copy", () => {
  it("localizes counts with a stable template and preserves source deduplication", () => {
    const source = analysisFixture()[0]!.summary!.sources[0]!;
    const malformed = {
      ...source,
      status: "partial" as const,
      malformedRecords: 3,
      message: "3 malformed or inconsistent usage record(s) were skipped; usage may be incomplete.",
    };
    const messages = usageSourceMessages([malformed, malformed]);
    expect(messages).toHaveLength(1);
    expect(uiText(MALFORMED_USAGE_WARNING_TEMPLATE, { count: 3 }, "zh-CN")).toBe(
      "已跳过 3 条格式异常或不一致的用量记录，统计可能不完整。",
    );
  });
  it("translates the entire price editor including its validation and scope", async () => {
    await using screen = await render(
      <UsagePriceOverrides
        usage={[]}
        initialSelectedEnvironmentIds={null}
        initialModel="test-model"
        onOpenChange={() => {}}
      />,
    );
    const dialog = page.getByRole("dialog");
    await expect.element(dialog.getByRole("button", { name: "保存更改" })).toBeDisabled();
    await expect.element(dialog.getByText("全部环境", { exact: true })).toBeVisible();
    for (const label of ["输入", "输出", "缓存读取", "缓存写入"])
      await expect.element(dialog.getByRole("cell", { name: label, exact: true })).toBeVisible();
    await userEvent.type(dialog.getByLabelText("test-model 的输入价格"), "2");
    await expect
      .element(dialog.getByRole("alert"))
      .toHaveTextContent("请填写 workstation 的输出价格。");
    await expect.element(dialog.getByRole("button", { name: "放弃更改" })).toBeVisible();
    expect(dialog.element().textContent).not.toMatch(
      /All environments|Save changes|Discard changes|Changes apply to|Input rate/,
    );
    expect(screen.container).toBeDefined();
  });
});
