import { ProviderDriverKind } from "@t3tools/contracts";
import { defineProviderClient } from "@t3tools/provider-core/client";

import { OpenCodeSettings } from "./settings.ts";

export const openCodeClient = defineProviderClient({
  driverKind: ProviderDriverKind.make("opencode"),
  label: "OpenCode",
  // Official Mark component from anomalyco/opencode (MIT); see NOTICE.
  icon: {
    viewBox: "0 0 16 20",
    fill: { light: "#1f1f1f", dark: "#eeeeee" },
    paths: [
      { d: "M12 16H4V8H12V16Z", fill: { light: "#d2d2d2", dark: "#4b4b4b" } },
      { d: "M12 4H4V16H12V4ZM16 20H0V0H16V20Z" },
    ],
  },
  acpRegistryAgentIds: ["opencode", "opencode-v2"],
  settingsSchema: OpenCodeSettings,
});
