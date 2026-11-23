import { uiText } from "~/i18n";
import { readUiLocale } from "~/i18n";
import type {
  ProviderConsumeResetCreditInput,
  ServerProviderResetCredits,
  ServerProviderUsageWindow,
} from "@t3tools/contracts";
import type { ResetCreditChoice } from "@t3tools/shared/usageLimits";
import { resetCreditChoices as rawChoices } from "@t3tools/shared/usageLimitsCopy";

export const RESET_EARLY_REMAINING_PERCENT = 50;
export function resetEffectLabel(label: string) {
  const known: Record<string, string> = {
    "5-hour reset": "Refill the 5-hour window",
    "Weekly reset": "Refill the weekly window",
    "Fable reset": "Refill Fable allowance",
    "Full reset": "Refill the 5-hour and weekly windows",
  };
  return uiText(known[label] ?? label);
}
export function resetExpiry(at: string | undefined) {
  return at && Number.isFinite(Date.parse(at))
    ? new Date(at).toLocaleDateString(readUiLocale(), { month: "2-digit", day: "2-digit" })
    : uiText("Expiry not reported");
}
export function resetCreditChoices(
  credits: ServerProviderResetCredits,
  input: ProviderConsumeResetCreditInput,
  now: number,
  compact = false,
): readonly ResetCreditChoice[] {
  return rawChoices(credits, input, now, compact)
    .map((choice) => {
      const option = credits.options?.find((o) => o.creditId === choice.key);
      return {
        ...choice,
        summary: uiText("{count} reset credits · earliest expiry {date}", {
          count: choice.availableCount,
          date: resetExpiry(option?.expiresAt ?? credits.nextExpiresAt),
        }),
        actionLabel: uiText("Use reset credit"),
        confirmDescription: option
          ? uiText("{effect}. One reset credit will be spent. This cannot be undone.", {
              effect: resetEffectLabel(option.label),
            })
          : uiText(
              "One reset credit will refill your current rate-limit windows. This cannot be undone.",
            ),
      };
    })
    .toSorted((a, b) => {
      const expiry = (c: ResetCreditChoice) =>
        Date.parse(
          credits.options?.find((o) => o.creditId === c.key)?.expiresAt ??
            credits.nextExpiresAt ??
            "",
        ) || Infinity;
      return expiry(a) - expiry(b);
    });
}

/** Only infer effects for the provider's known option labels. Unknown effects remain explicit. */
export function resetAffectedWindows(
  choice: ResetCreditChoice | null,
  credits: ServerProviderResetCredits | undefined,
  windows: readonly ServerProviderUsageWindow[],
) {
  const option = credits?.options?.find((o) => o.creditId === choice?.key);
  if (!option) return credits?.options?.length ? [] : windows;
  switch (option.label) {
    case "5-hour reset":
      return windows.filter((w) => w.kind === "session");
    case "Weekly reset":
      return windows.filter((w) => w.kind === "weekly" && !w.modelIds?.length);
    case "Full reset":
      return windows.filter(
        (w) => (w.kind === "session" || w.kind === "weekly") && !w.modelIds?.length,
      );
    // A Fable card gives back part of the weekly use, not the whole week.
    case "Fable reset":
      return windows.filter((w) => w.modelIds?.some((id) => /fable/i.test(id)));
    default:
      return [];
  }
}

export function resetFailureReason(reason: string) {
  if (readUiLocale() === "en" || /[\u4e00-\u9fff]/.test(reason)) return reason;
  if (/credit|redeem/i.test(reason))
    return uiText("The reset credit is no longer available. Refresh the quota and try again.");
  if (/auth|sign.?in|login|credential/i.test(reason))
    return uiText("The provider needs you to sign in again.");
  if (/timeout|network|connect|fetch/i.test(reason))
    return uiText("Could not connect to the provider. Try again later.");
  if (/disabled/i.test(reason)) return uiText("This provider is disabled.");
  return uiText(
    "The provider could not complete the reset. Refresh its quota to check the current status.",
  );
}

export function resetAdvanceLabel(resetsAt: string, now: number) {
  const hours = Math.max(0, (Date.parse(resetsAt) - now) / 3600000);
  if (!Number.isFinite(hours)) return uiText("Natural reset time not reported");
  return hours >= 48
    ? uiText("about {days} days earlier", { days: Math.round(hours / 24) })
    : uiText("about {hours} hours earlier", { hours: Math.round(hours) });
}
