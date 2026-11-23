import { describe, expect, it } from "vite-plus/test";

import {
  formatAppDisplayName,
  isStableReleaseChannel,
  resolveReleaseStageLabel,
  resolveServerBackedAppDisplayName,
  resolveServerBackedAppStageLabel,
} from "./branding.logic";
import {
  resolveEnvironmentIdentificationPillLabel,
  resolveSidebarStageBackdropVariant,
} from "./components/SidebarStageBackdrop";

// The Stardust stable build ships with the upstream base version stamp, which matches the
// Nightly pattern. The build flag (VITE_RELEASE_CHANNEL=stable) is what hides the badge.
const NIGHTLY_STAMP = "0.1.10-nightly.20261115.4749";

describe("stable release hides the Nightly stage", () => {
  it("keeps Nightly for nightly builds (no release channel flag)", () => {
    expect(
      resolveServerBackedAppStageLabel({
        primaryServerVersion: NIGHTLY_STAMP,
        fallbackStageLabel: "Beta",
      }),
    ).toBe("Nightly");
    expect(resolveReleaseStageLabel({ stageLabel: "Nightly", releaseChannel: null })).toBe(
      "Nightly",
    );
    expect(resolveReleaseStageLabel({ stageLabel: "Nightly", releaseChannel: "nightly" })).toBe(
      "Nightly",
    );
  });

  it("shows no Nightly stage on a stable build even with a nightly version stamp", () => {
    const stage = resolveServerBackedAppStageLabel({
      primaryServerVersion: NIGHTLY_STAMP,
      fallbackStageLabel: resolveReleaseStageLabel({
        stageLabel: "Nightly",
        releaseChannel: "stable",
      }),
      releaseChannel: "stable",
    });
    expect(stage).toBe("Latest");
    // No pill and no Nightly artwork for it, whichever identification mode the user picked.
    expect(resolveEnvironmentIdentificationPillLabel(stage)).toBeNull();
    for (const mode of ["artwork", "pill", "none"] as const) {
      expect(resolveSidebarStageBackdropVariant(stage, mode)).toBeNull();
    }
    // The window title carries no "(Nightly)" either.
    expect(formatAppDisplayName({ baseName: "T3 Stardust", stageLabel: stage })).toBe(
      "T3 Stardust",
    );
    expect(
      resolveServerBackedAppDisplayName({
        baseName: "T3 Stardust",
        fallbackDisplayName: "T3 Stardust",
        fallbackStageLabel: stage,
        primaryServerVersion: NIGHTLY_STAMP,
        releaseChannel: "stable",
      }),
    ).toBe("T3 Stardust");
  });

  it("still shows Dev on a stable flag, and Nightly artwork on a nightly build", () => {
    expect(resolveReleaseStageLabel({ stageLabel: "Dev", releaseChannel: "stable" })).toBe("Dev");
    expect(resolveEnvironmentIdentificationPillLabel("Nightly")).toBe("Nightly");
    expect(resolveSidebarStageBackdropVariant("Nightly", "artwork")).toBe("nightly");
  });

  it("reads the flag case-insensitively and ignores other channels", () => {
    expect(isStableReleaseChannel(" Stable ")).toBe(true);
    expect(isStableReleaseChannel("preview")).toBe(false);
    expect(isStableReleaseChannel(undefined)).toBe(false);
  });
});
