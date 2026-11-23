import {
  EnvironmentId,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  type ServerProvider,
} from "@t3tools/contracts";
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { applyThemePalette } from "~/themePalette";
import { render } from "../../../test/render";
import { testUiLocale } from "../../../test/uiLocale";
import { UsageLimitsPooled } from "./UsageLimitsPooled";
import "~/index.css";
import "./usagePresentation.css";

const mock = vi.hoisted(() => ({
  returnTarget: null as ReturnType<
    typeof import("../sidebar/mainAppLocation").getAppModalReturnThreadTarget
  >,
  threadShells: [] as ReturnType<typeof import("~/state/entities").readThreadShells>,
}));

vi.mock(import("../../state/session"), async (original) => ({
  ...(await original()),
  useEnvironmentScope: () => true,
  readEnvironmentScope: () => true,
}));

vi.mock(import("../sidebar/mainAppLocation"), async (original) => ({
  ...(await original()),
  getAppModalReturnThreadTarget: () => mock.returnTarget,
}));

vi.mock(import("~/state/entities"), async (original) => ({
  ...(await original()),
  readThreadShells: () => mock.threadShells,
}));

// Pin the apple theme inside this file only: writing it to localStorage leaks into test files
// running in parallel (they share one origin), which then render the wrong theme branch.
vi.mock(import("../../hooks/useTheme"), async (original) => {
  const actual = await original();
  return { ...actual, useTheme: () => ({ ...actual.useTheme(), theme: "apple" as const }) };
});

function appleTheme(mode: "light" | "dark" = "light") {
  const root = document.documentElement;
  const prevThemeId = root.getAttribute("data-theme-id");
  const prevStyle = root.getAttribute("style");
  const prevDark = root.classList.contains("dark");
  applyThemePalette("apple", mode);
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

function resetDraftStore() {
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
    stickyModelSelectionByProvider: {},
    stickyOptionsByModelByProvider: {},
    stickyActiveProvider: null,
  });
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
  slashCommands: [],
  skills: [],
};

function makePresentations(options?: { readonly allAmple?: boolean }) {
  const allAmple = options?.allAmple === true;
  const providers: ServerProvider[] = [
    {
      ...base,
      instanceId: ProviderInstanceId.make("codex"),
      driver: ProviderDriverKind.make("codex"),
      displayName: "Codex",
      models: [{ slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, isDefault: true }],
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
            usedPercent: allAmple ? 20 : 95,
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
          ],
        },
      },
    },
    {
      ...base,
      instanceId: ProviderInstanceId.make("claude3"),
      driver: ProviderDriverKind.make("claudeAgent"),
      displayName: "Claude 小号 3",
      models: [
        { slug: "claude-opus-4-6", name: "Claude Opus 4.6", isCustom: false, isDefault: true },
      ],
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
            resetsAt: at(0, 3),
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
      },
    },
    {
      ...base,
      instanceId: ProviderInstanceId.make("agy"),
      driver: ProviderDriverKind.make("antigravity"),
      displayName: "Antigravity",
      models: [{ slug: "gemini-4-neon", name: "Gemini 4 Neon", isCustom: false, isDefault: true }],
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

it("replaces empty slots with the V9 stardust compass card driven by live health data", async () => {
  using _locale = testUiLocale("zh-CN");
  using _theme = appleTheme("light");
  mock.returnTarget = null;
  mock.threadShells = [];
  resetDraftStore();

  await using screen = await render(
    <UsageLimitsPooled presentations={makePresentations() as never} now={now} />,
  );

  // Empty slots and their toggle are gone in Apple V9 limits view.
  expect(screen.container.querySelector("[data-limit-slot]")).toBeNull();
  expect(screen.container.querySelector(".usage-slots-toggle")).toBeNull();

  const compass = screen.container.querySelector<HTMLElement>("[data-usage-compass]")!;
  expect(compass).not.toBeNull();
  expect(compass.getAttribute("data-vid")).toBe("compass");
  expect(compass.getBoundingClientRect().height).toBe(224);

  // One orbit node per real pool (3 pools).
  expect(compass.querySelectorAll("[data-compass-node]")).toHaveLength(3);
  expect(compass.textContent).toContain("Codex");
  expect(compass.textContent).toContain("ChatGPT Pro");
  expect(compass.textContent).toContain("Antigravity 98%");
  expect(compass.textContent).toContain("2 轨充盈");
  expect(compass.textContent).toContain("1 轨预警");
  expect(compass.textContent).toContain("实时监测 3 条算力轨道");

  // Pointer tilt updates CSS vars on mouse move and resets on leave.
  compass.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerType: "mouse",
      clientX: compass.getBoundingClientRect().left + 10,
      clientY: compass.getBoundingClientRect().top + 10,
    }),
  );
  const tilt = compass.querySelector<HTMLElement>('[data-lv9~="vessel-tilt"]')!;
  expect(tilt.style.getPropertyValue("--rx")).not.toBe("");
  expect(tilt.style.getPropertyValue("--ry")).not.toBe("");
  compass.dispatchEvent(
    new PointerEvent("pointerout", {
      bubbles: true,
      pointerType: "mouse",
      relatedTarget: document.body,
    }),
  );
  expect(tilt.style.getPropertyValue("--rx")).toBe("0deg");
  expect(tilt.style.getPropertyValue("--ry")).toBe("0deg");

  // Flip to back face and back to front face; hidden face gets pointer-events: none.
  const flipBtn = compass.querySelector<HTMLButtonElement>('[data-flip-id="compass"]')!;
  await userEvent.click(flipBtn);
  expect(compass.hasAttribute("data-flipped")).toBe(true);
  const frontFace = compass.querySelector<HTMLElement>('[data-lv9="vessel-face compass-glass"]')!;
  expect(getComputedStyle(frontFace).pointerEvents).toBe("none");

  const backupRows = compass.querySelectorAll("[data-compass-backup]");
  expect(backupRows).toHaveLength(2);
  expect(backupRows[0]!.textContent).toContain("Antigravity");
  expect(backupRows[0]!.textContent).toContain("98%");
  expect(backupRows[1]!.textContent).toContain("Claude");
  expect(backupRows[1]!.textContent).toContain("45%");

  const backBtn = compass.querySelector<HTMLButtonElement>(
    '[data-lv9~="back"] [data-flip-id="compass"]',
  )!;
  await userEvent.click(backBtn);
  expect(compass.hasAttribute("data-flipped")).toBe(false);
  const backFace = compass.querySelector<HTMLElement>(
    '[data-lv9="vessel-face back compass-glass"]',
  )!;
  expect(getComputedStyle(backFace).pointerEvents).toBe("none");
});

it("switches the active thread's next-message model selection without altering sticky defaults", async () => {
  using _locale = testUiLocale("zh-CN");
  using _theme = appleTheme("light");
  resetDraftStore();

  const envId = EnvironmentId.make("desk");
  const threadRef = scopeThreadRef(envId, ThreadId.make("thread-live"));
  mock.returnTarget = { kind: "server", threadRef };
  mock.threadShells = [];
  useComposerDraftStore.getState().setStickyModelSelection({
    instanceId: ProviderInstanceId.make("codex"),
    model: "gpt-5.4",
  });

  await using screen = await render(
    <UsageLimitsPooled presentations={makePresentations() as never} now={now} />,
  );

  const compass = screen.container.querySelector<HTMLElement>("[data-usage-compass]")!;
  await userEvent.click(compass.querySelector<HTMLButtonElement>('[data-flip-id="compass"]')!);

  const useAgyBtn = compass.querySelector<HTMLButtonElement>('[data-compass-use="antigravity"]')!;
  await userEvent.click(useAgyBtn);

  const store = useComposerDraftStore.getState();
  const draft = store.getComposerDraft(threadRef);
  expect(draft?.activeProvider).toBe(ProviderInstanceId.make("agy"));
  expect(draft?.modelSelectionExplicit).toBe(true);
  expect(draft?.modelSelectionByProvider[ProviderInstanceId.make("agy")]?.model).toBe(
    "gemini-4-neon",
  );
  // Sticky default provider stays Codex.
  expect(store.stickyActiveProvider).toBe(ProviderInstanceId.make("codex"));
  expect(useAgyBtn.textContent).toContain("已设下条");

  mock.returnTarget = null;
  resetDraftStore();
});

it("falls back to focusing the target pool card when no thread exists to receive a draft override", async () => {
  using _locale = testUiLocale("zh-CN");
  using _theme = appleTheme("light");
  mock.returnTarget = null;
  mock.threadShells = [];
  resetDraftStore();

  await using screen = await render(
    <UsageLimitsPooled presentations={makePresentations() as never} now={now} />,
  );

  const compass = screen.container.querySelector<HTMLElement>("[data-usage-compass]")!;
  await userEvent.click(compass.querySelector<HTMLButtonElement>('[data-flip-id="compass"]')!);
  await userEvent.click(
    compass.querySelector<HTMLButtonElement>('[data-compass-use="antigravity"]')!,
  );

  // The flash clears after 800ms, so assert the persistent highlight instead of racing the timer.
  expect(
    screen.container.querySelector("[data-usage-limit-grid]")?.getAttribute("data-highlighted"),
  ).toBe("antigravity");
});

it("also applies next-message switch to a local draft thread when returning to a draft", async () => {
  using _locale = testUiLocale("zh-CN");
  using _theme = appleTheme("light");
  resetDraftStore();

  const envId = EnvironmentId.make("desk");
  const draftId = DraftId.make("draft-1");
  useComposerDraftStore
    .getState()
    .setProjectDraftThreadId(scopeProjectRef(envId, ProjectId.make("proj-1")), draftId);
  mock.returnTarget = { kind: "draft", draftId };
  mock.threadShells = [];

  await using screen = await render(
    <UsageLimitsPooled presentations={makePresentations({ allAmple: true }) as never} now={now} />,
  );

  const compass = screen.container.querySelector<HTMLElement>("[data-usage-compass]")!;
  expect(compass.textContent).toContain("全轨道满血就绪");
  expect(compass.textContent).toContain("3 轨充盈");
  expect(compass.textContent).not.toContain("alert orbits");

  await userEvent.click(compass.querySelector<HTMLButtonElement>('[data-flip-id="compass"]')!);
  const codexBtn = compass.querySelector<HTMLButtonElement>('[data-compass-use="codex"]')!;
  await userEvent.click(codexBtn);

  const draft = useComposerDraftStore.getState().getComposerDraft(draftId);
  expect(draft?.activeProvider).toBe(ProviderInstanceId.make("codex"));
  expect(draft?.modelSelectionByProvider[ProviderInstanceId.make("codex")]?.model).toBe("gpt-5.4");

  mock.returnTarget = null;
  resetDraftStore();
});
