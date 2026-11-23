import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { testUiLocale } from "../../../test/uiLocale";
import { applyThemePalette } from "~/themePalette";
import { UsageLimitsPooled } from "./UsageLimitsPooled";
import "~/index.css";
import "./usagePresentation.css";

const mock = vi.hoisted(() => ({
  calls: [] as string[],
}));

vi.mock(import("../../state/session"), async (original) => ({
  ...(await original()),
  useEnvironmentScope: () => true,
  readEnvironmentScope: () => true,
}));

vi.mock("../../state/use-atom-command", () => ({
  useAtomCommand: (command: { label: string }) => async () => {
    mock.calls.push(command.label);
    return { _tag: "Success", value: { outcome: "reset" } };
  },
}));

// Pin the apple theme inside this file only: writing it to localStorage leaks into test files
// running in parallel (they share one origin), which then render the wrong theme branch.
vi.mock(import("../../hooks/useTheme"), async (original) => {
  const actual = await original();
  return { ...actual, useTheme: () => ({ ...actual.useTheme(), theme: "apple" as const }) };
});

function appleLightTheme() {
  const root = document.documentElement;
  const prevThemeId = root.getAttribute("data-theme-id");
  const prevStyle = root.getAttribute("style");
  const prevDark = root.classList.contains("dark");
  applyThemePalette("apple", "light");
  return {
    [Symbol.dispose]() {
      if (prevThemeId === null) root.removeAttribute("data-theme-id");
      else root.setAttribute("data-theme-id", prevThemeId);
      if (prevStyle === null) root.removeAttribute("style");
      else root.setAttribute("style", prevStyle);
      root.classList.toggle("dark", prevDark);
    },
  };
}

const now = new Date("2026-11-20T10:05:00").getTime();
const at = (days: number, hours = 0) =>
  new Date(now + days * 86_400_000 + hours * 3_600_000).toISOString();

const base = {
  enabled: true,
  installed: true,
  version: "1",
  status: "ready" as const,
  checkedAt: new Date(now - 60_000).toISOString(),
  models: [],
  slashCommands: [],
  skills: [],
};

function fixturePresentations() {
  const providers: ServerProvider[] = [
    {
      ...base,
      instanceId: ProviderInstanceId.make("codex"),
      driver: ProviderDriverKind.make("codex"),
      displayName: "Codex",
      auth: { status: "authenticated", label: "ChatGPT Pro" },
      usageLimits: {
        checkedAt: base.checkedAt,
        windows: [
          {
            id: "session",
            kind: "session",
            label: "5-hour",
            usedPercent: 26,
            windowDurationMins: 300,
            resetsAt: at(0, 2.4),
          },
          {
            id: "weekly",
            kind: "weekly",
            label: "Weekly",
            usedPercent: 95,
            windowDurationMins: 10080,
            resetsAt: at(2, 9),
          },
        ],
        resetCredits: {
          availableCount: 3,
          nextExpiresAt: at(2, 13),
          nextCreditId: "cx-wk-exp",
          options: [
            {
              creditId: "cx-wk-exp",
              label: "Weekly reset",
              description: "Refills weekly limit",
              availableCount: 1,
              expiresAt: at(2, 13),
            },
            {
              creditId: "cx-wk-std",
              label: "Weekly reset",
              description: "Refills weekly limit",
              availableCount: 1,
              expiresAt: at(18),
            },
            {
              creditId: "cx-5h",
              label: "5-hour reset",
              description: "Refills 5h limit",
              availableCount: 1,
              expiresAt: at(5),
            },
          ],
        },
      },
    },
    {
      ...base,
      instanceId: ProviderInstanceId.make("claude3"),
      driver: ProviderDriverKind.make("claudeAgent"),
      displayName: "Claude 小号 3",
      auth: { status: "authenticated", label: "Claude Pro", email: "c@example.invalid" },
      usageLimits: {
        checkedAt: base.checkedAt,
        windows: [
          {
            id: "five_hour",
            kind: "session",
            label: "5-hour",
            usedPercent: 18,
            windowDurationMins: 300,
            resetsAt: at(0, 3.0),
          },
          {
            id: "seven_day",
            kind: "weekly",
            label: "Weekly",
            usedPercent: 55,
            windowDurationMins: 10080,
            resetsAt: at(3, -1),
          },
        ],
        resetCredits: {
          availableCount: 2,
          nextExpiresAt: at(4),
          options: [
            {
              creditId: "cl-5h",
              label: "5-hour reset",
              description: "Refills 5h limit",
              availableCount: 1,
              expiresAt: at(4),
            },
            {
              creditId: "cl-wk",
              label: "Weekly reset",
              description: "Refills weekly limit",
              availableCount: 1,
              expiresAt: at(10),
            },
          ],
        },
      },
    },
    {
      ...base,
      instanceId: ProviderInstanceId.make("agy"),
      driver: ProviderDriverKind.make("antigravity"),
      displayName: "Antigravity",
      auth: { status: "authenticated", label: "Google 全量池" },
      usageLimits: {
        checkedAt: base.checkedAt,
        windows: [
          {
            id: "gemini-pro",
            kind: "weekly",
            label: "Gemini Pro",
            usedPercent: 2,
            windowDurationMins: 10080,
            resetsAt: at(6, 0),
          },
          {
            id: "gemini-flash",
            kind: "session",
            label: "Gemini Flash",
            usedPercent: 0,
            windowDurationMins: 300,
            resetsAt: at(0, 4),
          },
        ],
      },
    },
  ] as unknown as ServerProvider[];

  return new Map([
    [
      EnvironmentId.make("desk"),
      { entry: { target: { label: "Desk" } }, serverConfig: { providers } },
    ],
  ]);
}

it("renders V11 sorted cards, health hero chip flash, V13 pace meters, tray live preview + 2-step confirm, gantt trigger, and 3D orbit meter", async () => {
  using _locale = testUiLocale("zh-CN");
  using _theme = appleLightTheme();
  mock.calls = [];

  await using screen = await render(
    <UsageLimitsPooled presentations={fixturePresentations() as never} now={now} />,
  );

  // 1. V11: no plan/card-pool bar; cards and hero chips run from most quota left to least.
  expect(screen.container.querySelector("[data-usage-card-pool]")).toBeNull();
  const cardOrder = [
    ...screen.container.querySelectorAll('[data-usage-limit-grid] [id^="usage-limit-"]'),
  ].map((card) => card.id.replace("usage-limit-", ""));
  expect(cardOrder).toEqual(["antigravity", "claudeAgent", "codex"]);
  const chipOrder = [...screen.container.querySelectorAll("[data-jump-card]")].map((chip) =>
    chip.getAttribute("data-jump-card"),
  );
  expect(chipOrder).toEqual(cardOrder);

  // 2. Hero risk chip highlights & flashes target card on click.
  const codexChip = screen.container.querySelector<HTMLButtonElement>('[data-jump-card="codex"]')!;
  await userEvent.click(codexChip);
  expect(
    screen.container
      .querySelector('#usage-limit-codex [data-lv9~="vessel-outer"]')
      ?.hasAttribute("data-flash"),
  ).toBe(true);

  // 3. V13: each window is one meter with a time mark; the card flips 180° to its burn curve and back.
  const meters = screen.container.querySelectorAll('#usage-limit-codex [data-lv9~="v13-meter"]');
  expect(meters).toHaveLength(2);
  expect(meters[0]!.querySelector('[data-lv9~="v13-fill"]')).not.toBeNull();
  expect(meters[0]!.querySelector("[data-usage-pace]")).not.toBeNull();
  const flipBtn = screen.container.querySelector<HTMLButtonElement>(
    '#usage-limit-codex [data-lv9~="flip-icon-btn"]',
  )!;
  await userEvent.click(flipBtn);
  const codexVessel = screen.container.querySelector(
    '#usage-limit-codex [data-lv9~="vessel-outer"]',
  )!;
  expect(codexVessel.hasAttribute("data-flipped")).toBe(true);
  const backBtn = codexVessel.querySelector<HTMLButtonElement>(
    '[data-lv9~="back"] [data-lv9~="flip-icon-btn"]',
  )!;
  await userEvent.click(backBtn);
  expect(codexVessel.hasAttribute("data-flipped")).toBe(false);

  // 4. Clicking Gantt clickable use-card node opens tray with live optical + gantt gap preview.
  const ganttNode = screen.container.querySelector<SVGGElement>(
    '[data-timeline-rc-trigger="codex"]',
  )!;
  await userEvent.click(ganttNode);
  const trayShell = screen.container.querySelector("[data-usage-reset-tray-shell]")!;
  expect(trayShell.hasAttribute("data-open")).toBe(true);
  expect(
    screen.container.querySelectorAll('#usage-limit-codex [data-lv9~="v13-preview"]').length,
  ).toBeGreaterThan(0);
  expect(screen.container.querySelector("[data-timeline-gap-preview]")).not.toBeNull();

  // Switching to 5h card removes the weekly Gantt gap-fill preview.
  const sessionCard = screen.container.querySelector<HTMLButtonElement>(
    '[data-pick-card="cx-5h"]',
  )!;
  await userEvent.click(sessionCard);
  expect(screen.container.querySelector("[data-timeline-gap-preview]")).toBeNull();

  // Switch back to weekly card and exercise inline 2-step confirmation + cancel + confirm.
  const weeklyCard = screen.container.querySelector<HTMLButtonElement>(
    '[data-pick-card="cx-wk-exp"]',
  )!;
  await userEvent.click(weeklyCard);
  expect(screen.container.querySelector("[data-timeline-gap-preview]")).not.toBeNull();

  const useBtn = screen.container.querySelector<HTMLButtonElement>('[data-lv9~="rc-btn-primary"]')!;
  await userEvent.click(useBtn);
  expect(screen.container.querySelector('[data-lv9~="rc-confirm-bar"]')).not.toBeNull();
  expect(mock.calls).toHaveLength(0);

  const cancelBtn = screen.container.querySelector<HTMLButtonElement>(
    '[data-lv9~="rc-confirm-bar"] [data-lv9~="chip-btn"]',
  )!;
  await userEvent.click(cancelBtn);
  expect(screen.container.querySelector('[data-lv9~="rc-confirm-bar"]')).toBeNull();

  await userEvent.click(
    screen.container.querySelector<HTMLButtonElement>('[data-lv9~="rc-btn-primary"]')!,
  );
  const confirmBtn = screen.container.querySelector<HTMLButtonElement>(
    '[data-lv9~="rc-btn-danger"]',
  )!;
  await userEvent.click(confirmBtn);
  await vi.waitFor(() => expect(mock.calls).toHaveLength(2));

  // 5. Orbit meter shows real average (49%), warns on low node (<=20%), and flips 180°.
  const orbit = screen.container.querySelector("[data-usage-orbit-meter]")!;
  expect(orbit.textContent).toContain("49%");
  expect(orbit.querySelectorAll('[data-lv9~="orbit-node"][data-low]')).toHaveLength(1);
  const orbitCard = orbit.querySelector<HTMLElement>('[data-lv9~="holo-card"]')!;
  await userEvent.click(orbitCard);
  expect(orbitCard.hasAttribute("data-flipped")).toBe(true);

  // 6. Card #4 in the 2x2 grid is the V9 stardust compass (no empty slots or slot toggle).
  expect(screen.container.querySelector("[data-limit-slot]")).toBeNull();
  expect(screen.container.querySelector(".usage-slots-toggle")).toBeNull();
  const compass = screen.container.querySelector<HTMLElement>('[data-vid="compass"]')!;
  expect(compass).not.toBeNull();
  await userEvent.click(compass.querySelector<HTMLButtonElement>('[data-flip-id="compass"]')!);
  expect(compass.hasAttribute("data-flipped")).toBe(true);
});

it("V14 caps cards at two windows, reorders from the keyboard, remembers it and restores the auto order", async () => {
  using _locale = testUiLocale("zh-CN");
  using _theme = appleLightTheme();
  localStorage.removeItem("t3code:usage-limit-card-order:v1");
  const presentations = fixturePresentations() as never as Map<
    string,
    { serverConfig: { providers: ServerProvider[] } }
  >;
  const agy = [...presentations.values()][0]!.serverConfig.providers.find(
    (provider) => provider.driver === "antigravity",
  )!;
  (agy.usageLimits!.windows as unknown as object[]).push({
    id: "claude-gpt",
    kind: "weekly",
    label: "Claude/GPT-OSS shared",
    usedPercent: 0,
    windowDurationMins: 10080,
    resetsAt: at(6, 0),
  });
  try {
    await using screen = await render(
      <UsageLimitsPooled presentations={presentations as never} now={now} />,
    );
    const order = () =>
      [...screen.container.querySelectorAll("[data-limit-sortable]")].map((node) =>
        node.getAttribute("data-limit-sortable"),
      );
    // The unused shared pool leaves the card; the footer counts it instead.
    const agyCard = screen.container.querySelector("#usage-limit-antigravity")!;
    expect(agyCard.querySelectorAll('[data-lv9~="v13-row"]')).toHaveLength(2);
    expect(agyCard.querySelector('[data-lv9~="more-windows"]')?.textContent).toBe("另有 1 个窗口");
    for (const card of screen.container.querySelectorAll("[data-usage-card]"))
      expect(card.querySelectorAll('[data-lv9~="v13-row"]').length).toBeLessThanOrEqual(2);

    const auto = order();
    expect(auto).toEqual(["antigravity", "claudeAgent", "codex"]);
    expect(screen.container.querySelector("[data-usage-restore-order]")).toBeNull();
    const codexTrigger = screen.container.querySelector<HTMLElement>(
      '#usage-limit-codex [data-lv9~="vessel-trigger"]',
    )!;
    codexTrigger.focus();
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await vi.waitFor(() => expect(order()).toEqual(["antigravity", "codex", "claudeAgent"]));
    expect(JSON.parse(localStorage.getItem("t3code:usage-limit-card-order:v1")!)).toEqual([
      "antigravity",
      "codex",
      "claudeAgent",
    ]);
    // The hero chips follow the cards.
    expect(
      [...screen.container.querySelectorAll("[data-jump-card]")].map((chip) =>
        chip.getAttribute("data-jump-card"),
      ),
    ).toEqual(["antigravity", "codex", "claudeAgent"]);
    await userEvent.click(
      screen.container.querySelector<HTMLButtonElement>("[data-usage-restore-order]")!,
    );
    await vi.waitFor(() => expect(order()).toEqual(auto));
    expect(localStorage.getItem("t3code:usage-limit-card-order:v1")).toBeNull();
  } finally {
    localStorage.removeItem("t3code:usage-limit-card-order:v1");
  }
});
