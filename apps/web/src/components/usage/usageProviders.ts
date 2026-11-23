import { uiText } from "~/i18n";
import type { UsageProviderKind } from "@t3tools/contracts";

import { ProviderDriverKind } from "@t3tools/contracts";

import type { UsageMetric } from "./usageShortcuts";

type UsageProviderPresentation = {
  readonly label: string;
  readonly color: string;
  readonly driverKind: ProviderDriverKind;
};

export const PROVIDER_PRESENTATION = {
  codex: {
    label: "Codex",
    color: "var(--usage-codex)",
    driverKind: ProviderDriverKind.make("codex"),
  },
  claude: {
    label: "Claude Code",
    color: "var(--usage-claude)",
    driverKind: ProviderDriverKind.make("claudeAgent"),
  },
  grok: {
    label: "Grok Build",
    color: "var(--usage-grok)",
    driverKind: ProviderDriverKind.make("grok"),
  },
  cursor: {
    label: "Cursor",
    color: "var(--usage-other)",
    driverKind: ProviderDriverKind.make("cursor"),
  },
  opencode: {
    label: "OpenCode",
    color: "var(--usage-other)",
    driverKind: ProviderDriverKind.make("opencode"),
  },
  antigravity: {
    label: "Antigravity",
    color: "var(--usage-antigravity)",
    driverKind: ProviderDriverKind.make("antigravity"),
  },
  pi: {
    label: "Pi",
    color: "var(--usage-other)",
    driverKind: ProviderDriverKind.make("pi"),
  },
  muse: {
    label: "Muse Code",
    color: "var(--usage-other)",
    driverKind: ProviderDriverKind.make("muse"),
  },
} satisfies Record<UsageProviderKind, UsageProviderPresentation>;

export const PROVIDER_ORDER = [
  "codex",
  "claude",
  "grok",
  "antigravity",
  "cursor",
  "opencode",
  "pi",
  "muse",
] as UsageProviderKind[];

export function providersWithUsage(
  totals: readonly {
    readonly provider: UsageProviderKind;
    readonly costUsd: number;
    readonly totalTokens: number;
  }[],
): readonly UsageProviderKind[] {
  const active = new Set(
    totals
      .filter((entry) => entry.totalTokens > 0 || entry.costUsd > 0)
      .map((entry) => entry.provider),
  );
  return PROVIDER_ORDER.filter((provider) => active.has(provider));
}

export function usageSeries(provider: UsageProviderKind): UsageProviderKind {
  return ["codex", "claude", "grok", "antigravity"].includes(provider) ? provider : "cursor";
}
export const USAGE_SERIES_ORDER: readonly UsageProviderKind[] = [
  "codex",
  "claude",
  "grok",
  "antigravity",
  "cursor",
];
export function usageSeriesLabel(provider: UsageProviderKind) {
  return provider === "cursor" ? uiText("Other providers") : PROVIDER_PRESENTATION[provider].label;
}

export function rankProvidersByMetric(
  providers: readonly UsageProviderKind[],
  totals: readonly {
    readonly provider: UsageProviderKind;
    readonly costUsd: number;
    readonly totalTokens: number;
  }[],
  metric: UsageMetric,
): readonly UsageProviderKind[] {
  const field = metric === "cost" ? "costUsd" : "totalTokens";
  const value = (provider: UsageProviderKind) =>
    totals.find((entry) => entry.provider === provider)?.[field] ?? 0;
  return providers.toSorted((left, right) => value(right) - value(left));
}
