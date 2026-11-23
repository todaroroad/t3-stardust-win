import { createRef } from "react";
import { expect, it, vi } from "vite-plus/test";
import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  USAGE_CONTRACT_VERSION,
  UsageDay,
  type ServerProvider,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { createModelCapabilities } from "@t3tools/shared/model";
import { mergeUsage } from "@t3tools/shared/usageMerge";
import { render } from "../../../test/render";
import { testUiLocale } from "../../../test/uiLocale";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { useUsage } from "../../state/usage";
import { ModelPickerContent } from "./ModelPickerContent";

vi.mock(import("../../state/usage"), async (original) => ({
  ...(await original()),
  useUsage: vi.fn(),
}));

function makeReasoningModel(slug: string, name: string, levels: number): ServerProviderModel {
  const options = Array.from({ length: levels }, (_, index) => ({
    id: `level-${index}`,
    label: `L${index + 1}`,
  }));
  return {
    slug,
    name,
    isCustom: false,
    capabilities: createModelCapabilities({
      optionDescriptors: [
        {
          id: "reasoningEffort",
          label: "Reasoning",
          type: "select",
          role: "reasoning",
          currentValue: options[0]!.id,
          options,
        },
      ],
    }),
  };
}

const FIXED_NOW_MS = Date.parse("2026-11-16T16:00:00Z");

function makeInstanceEntry(input: {
  readonly id: string;
  readonly driver: string;
  readonly displayName: string;
  readonly models: readonly ServerProviderModel[];
  readonly usedPercent: number;
}): ProviderInstanceEntry {
  const instanceId = ProviderInstanceId.make(input.id);
  const driverKind = ProviderDriverKind.make(input.driver);
  const nowIso = "2026-11-16T16:00:00.000Z";
  const resetsAt = "2026-11-17T16:00:00.000Z";
  const snapshot: ServerProvider = {
    instanceId,
    driver: driverKind,
    displayName: input.displayName,
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: nowIso,
    models: input.models,
    slashCommands: [],
    skills: [],
    usageLimits: {
      checkedAt: nowIso,
      windows: [
        {
          id: "weekly",
          kind: "weekly",
          label: "Week",
          usedPercent: input.usedPercent,
          resetsAt,
        },
      ],
    },
  };
  return {
    instanceId,
    driverKind,
    displayName: input.displayName,
    enabled: true,
    installed: true,
    status: "ready",
    isDefault: true,
    isAvailable: true,
    snapshot,
    models: input.models,
  };
}

it("renders real-data speed/price tags and respects low-quota priority in ModelPickerContent", async () => {
  using _locale = testUiLocale("zh-CN");
  const nowSpy = vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW_MS);
  const envId = EnvironmentId.make("env-local");
  const merged = mergeUsage(
    [
      {
        environmentId: envId,
        label: "Local",
        summary: {
          contractVersion: USAGE_CONTRACT_VERSION,
          readAt: "2026-11-16T16:00:00Z",
          timeZone: "UTC",
          sinceDay: UsageDay.make("2026-10-18"),
          untilDay: UsageDay.make("2026-11-16"),
          buckets: [],
          sources: [],
          pricing: {
            status: "fresh",
            source: "litellm",
            fetchedAt: null,
            knownModels: 4,
            modelUnitPrices: {
              "gemini-4-neon": 0.00000725,
              "gemini-3.8-flash": 0.00000145,
              "gpt-6-astra": 0.000015,
              "gpt-5.4-mini": 0.000002,
            },
          },
          throughput: [
            {
              provider: "antigravity",
              model: "gemini-3.8-flash",
              outputTokens: 7000,
              modelMs: 50_000,
              turns: 8,
            },
            {
              provider: "codex",
              model: "gpt-5.4-mini",
              outputTokens: 4000,
              modelMs: 50_000,
              turns: 6,
            },
          ],
          scanDurationMs: 1,
        },
      },
    ],
    USAGE_CONTRACT_VERSION,
  );
  vi.mocked(useUsage).mockReturnValue({
    merged,
    environments: [],
    selectedEnvironments: [],
    isPending: false,
    isPartial: false,
    shown: null,
    refresh: vi.fn(async () => {}),
  });

  const agModels = [
    makeReasoningModel("gemini-4-neon", "Gemini 4 Neon", 4),
    makeReasoningModel("gemini-3.8-flash", "Gemini 3.8 Flash", 3),
  ];
  const codexModels = [
    makeReasoningModel("gpt-6-astra", "GPT-6 Astra", 4),
    makeReasoningModel("gpt-5.4-mini", "GPT-5.4 Mini", 3),
  ];
  const agEntry = makeInstanceEntry({
    id: "antigravity",
    driver: "antigravity",
    displayName: "Gemini",
    models: agModels,
    usedPercent: 2,
  });
  const codexEntry = makeInstanceEntry({
    id: "codex",
    driver: "codex",
    displayName: "Codex",
    models: codexModels,
    usedPercent: 95,
  });

  try {
    await using screen = await render(
      <ModelPickerContent
        environmentId={envId}
        activeInstanceId={agEntry.instanceId}
        model="gemini-4-neon"
        lockedProvider={null}
        instanceEntries={[agEntry, codexEntry]}
        modelOptionsByInstance={
          new Map([
            [agEntry.instanceId, agModels],
            [codexEntry.instanceId, codexModels],
          ])
        }
        terminalOpen={false}
        onInstanceModelChange={() => {}}
        searchInputRef={createRef<HTMLInputElement>()}
      />,
      { router: false },
    );

    // Antigravity tab: Neon shows 剩 98%, Flash shows Fast & Low-cost (quota 98% > 20%).
    const metas = [...screen.container.querySelectorAll<HTMLElement>("[data-v9-mp-meta]")].map(
      (node) => node.textContent,
    );
    expect(metas).toEqual(["4 档 · 剩 98%", "3 档 · 极速低价"]);

    // V9 Spotlight search box with its icon, Chinese placeholder, and shortcut hint.
    const search = document.querySelector("[data-v9-mp-search]");
    expect(search?.querySelector("[data-v9-mp-search-icon]")).not.toBeNull();
    expect(search?.querySelector("input")?.getAttribute("placeholder")).toBe("搜索模型…");
    expect(search?.querySelector("[data-v9-mp-search-kbd]")?.textContent).toBeTruthy();

    // Codex tab: quota is 5% (<= 20%), so even Low-cost gpt-5.4-mini MUST show 剩 5% with data-low.
    const codexTab = screen.getByRole("button", { name: "Codex" });
    await codexTab.click();
    const codexMetaEls = [...screen.container.querySelectorAll<HTMLElement>("[data-v9-mp-meta]")];
    expect(codexMetaEls.map((node) => node.textContent)).toEqual(["4 档 · 剩 5%", "3 档 · 剩 5%"]);
    expect(codexMetaEls.every((node) => node.getAttribute("data-low") === "true")).toBe(true);
  } finally {
    nowSpy.mockRestore();
    vi.mocked(useUsage).mockReset();
  }
});
