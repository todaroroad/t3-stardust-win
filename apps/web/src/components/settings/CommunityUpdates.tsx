import { uiText } from "../../i18n";
import { useEffect } from "react";
import { isElectron } from "../../env";
import { useCommunityUpdates } from "../../state/communityUpdates";
import {
  COMMUNITY_BASE_TAG,
  COMMUNITY_CHECK_INTERVAL_MS,
  COMMUNITY_RELEASES_URL,
  communityUpdateActions,
} from "../../state/communityUpdates.logic";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { toastManager } from "../ui/toast";
import { SettingsRow } from "./settingsLayout";
import { StardustStatsRow } from "./StardustStats";
import { openDesktopUpdateReleaseNotes } from "../desktopUpdate.toast";
const openPage = (url: string) => {
  void openDesktopUpdateReleaseNotes(window.desktopBridge, url);
};
export function CommunityUpdateCoordinator() {
  const automatic = useCommunityUpdates((s) => s.automatic);
  const release = useCommunityUpdates((s) => s.release);
  const status = useCommunityUpdates((s) => s.status);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Own the desktop update polling timers while this coordinator is mounted.
  useEffect(() => {
    if (!isElectron || !automatic) return;
    const timer = window.setTimeout(() => {
      void useCommunityUpdates.getState().check();
    }, 10_000);
    const interval = window.setInterval(() => {
      void useCommunityUpdates.getState().check();
    }, COMMUNITY_CHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [automatic]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Synchronize the imperative toast surface with a newly observed community release.
  useEffect(() => {
    if (!isElectron || status !== "available" || !release) return;
    const state = useCommunityUpdates.getState();
    if (state.notifiedTag === release.tag) return;
    state.markNotified(release.tag);
    toastManager.add({
      type: "info",
      title: uiText("T3 Stardust {tag} is available", { tag: release.tag }),
      description: (
        <>
          <span>
            {state.mode === "custom"
              ? uiText("Source mode lets you review and merge changes in your fork.")
              : uiText("Review the update and download it when you’re ready.")}
          </span>
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => openPage(state.mode === "custom" ? release.compareUrl : release.url)}
          >
            {uiText("View update")}
          </button>
        </>
      ),
    });
  }, [release, status]);
  return null;
}
export function CommunityUpdateSettings() {
  const state = useCommunityUpdates();
  const actions = communityUpdateActions(state.mode);
  return (
    <>
      <SettingsRow
        title={uiText("Community update mode")}
        description={uiText(
          "Standard mode links to release downloads. Source mode links to source changes. Updating and restarting are manual in both modes.",
        )}
        control={
          <select
            aria-label={uiText("Community update mode")}
            className="rounded-md border bg-background px-2 py-1 text-sm"
            value={state.mode}
            onChange={(e) => state.setMode(e.target.value === "standard" ? "standard" : "custom")}
          >
            <option value="standard">{uiText("Standard · Confirm updates manually")}</option>
            <option value="custom">{uiText("Source mode · Notify only")}</option>
          </select>
        }
      />
      <SettingsRow
        title={uiText("Check for community updates automatically")}
        description={uiText(
          "Checks public GitHub releases at startup and every 6 hours. Conversation, account, and project data stay on your device.",
        )}
        control={
          <Switch
            aria-label={uiText("Check for community updates automatically")}
            checked={state.automatic}
            onCheckedChange={state.setAutomatic}
          />
        }
      />
      <StardustStatsRow />
      <SettingsRow
        title={uiText("Stardust Community · Mac Apple Silicon")}
        description={
          state.status === "checking"
            ? uiText("Checking…")
            : state.status === "available"
              ? uiText("{version} available · {action}", {
                  version: state.release?.tag,
                  action:
                    state.mode === "custom"
                      ? uiText("Review and merge source changes as needed")
                      : uiText("Review the notes, then download manually"),
                })
              : state.status === "current"
                ? uiText("You have the latest community release.")
                : uiText("Checks the Stardust Community release feed only.")
        }
        control={
          <Button
            size="sm"
            variant="outline"
            disabled={state.status === "checking"}
            onClick={() => {
              void state.check(true);
            }}
          >
            {uiText("Check for Updates")}
          </Button>
        }
      />
      <div className="space-y-2 px-1 text-sm text-muted-foreground">
        <p>
          {uiText("Community baseline:")}
          {COMMUNITY_BASE_TAG}
          {uiText(". Your local source may contain additional changes.")}
        </p>
        {state.error && <p role="status">{state.error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openPage(state.release?.url ?? COMMUNITY_RELEASES_URL)}
          >
            {uiText("View release notes")}
          </Button>
          {state.status === "available" && state.release && actions.canOpenDownloadPage && (
            <Button size="sm" onClick={() => openPage(state.release!.url)}>
              {uiText("Open download page")}
            </Button>
          )}
          {state.status === "available" && state.release && actions.canViewSourceDiff && (
            <Button size="sm" variant="outline" onClick={() => openPage(state.release!.compareUrl)}>
              {uiText("View source changes")}
            </Button>
          )}
        </div>
        {state.mode === "custom" && (
          <p>
            {uiText(
              "Review and merge the changes in your fork before building. Replacing the app can overwrite your customizations.",
            )}
          </p>
        )}
      </div>
    </>
  );
}
