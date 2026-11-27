import { uiText } from "./i18n";
import type { DesktopAppBranding } from "@t3tools/contracts";
import {
  formatAppDisplayName,
  resolveHostedAppChannelLabel,
  resolveReleaseStageLabel,
  resolveWebAppStageLabel,
} from "./branding.logic";

function readInjectedDesktopAppBranding(): DesktopAppBranding | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.desktopBridge?.getAppBranding() ?? null;
}

const injectedDesktopAppBranding = readInjectedDesktopAppBranding();
const hostedAppChannel = import.meta.env.VITE_HOSTED_APP_CHANNEL?.trim().toLowerCase();

export const HOSTED_APP_CHANNEL =
  hostedAppChannel === "latest" || hostedAppChannel === "nightly" ? hostedAppChannel : null;
export const HOSTED_APP_CHANNEL_LABEL = resolveHostedAppChannelLabel(HOSTED_APP_CHANNEL);
export const APP_BASE_NAME = "T3星辰版";
export function appBaseName(): string {
  return "T3星辰版";
}
// Set by the stable release build (VITE_RELEASE_CHANNEL=stable). Such a build hides the Nightly
// stage even though it carries the upstream nightly version stamp.
export const RELEASE_CHANNEL = import.meta.env.VITE_RELEASE_CHANNEL?.trim().toLowerCase() || null;
const BUILD_STAGE_LABEL =
  injectedDesktopAppBranding?.stageLabel ??
  resolveWebAppStageLabel({
    hostedAppChannel: HOSTED_APP_CHANNEL,
    development: import.meta.env.DEV,
  });
export const APP_STAGE_LABEL = resolveReleaseStageLabel({
  stageLabel: BUILD_STAGE_LABEL,
  releaseChannel: RELEASE_CHANNEL,
});
export const APP_DISPLAY_NAME = "T3星辰版";
export function appDisplayName(): string {
  return "T3星辰版";
}
export const APP_VERSION = import.meta.env.APP_VERSION || "0.0.0";
export const DESKTOP_DOWNLOAD_URL = "https://github.com/todaroroad/t3-stardust-win/releases";
// Redirects to the App Store or Google Play to match the phone that opens it.
export const MOBILE_APP_URL = "https://github.com/todaroroad/t3-stardust-win";
