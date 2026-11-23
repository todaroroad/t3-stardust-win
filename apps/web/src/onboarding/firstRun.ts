import type { SidebarCategoryPreset } from "@t3tools/contracts/settings";
import { ensureClientSettingsHydrated, persistClientSettingsUpdate } from "../hooks/useSettings";

export async function completeOnboarding(preset?: SidebarCategoryPreset): Promise<void> {
  await ensureClientSettingsHydrated();
  const onboardingCompletedAt = new Date().toISOString();
  await persistClientSettingsUpdate((current) => ({
    ...current,
    onboardingCompletedAt,
    ...(preset === undefined
      ? {}
      : { sidebarCategories: { ...current.sidebarCategories, preset } }),
  }));
}
