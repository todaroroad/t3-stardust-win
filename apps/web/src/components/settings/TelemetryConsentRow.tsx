import { useUiText } from "~/i18n/useUiText";
import { managedTelemetryOffMessage, usePrimaryManagedPolicy } from "~/state/managedPolicy";
import { ScopedSwitch } from "./ScopedSwitch";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

/** Usage statistics are opt-in: this switch is the only way the server starts sending them. */
export function TelemetryConsentRow() {
  const text = useUiText();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const managedOff = managedTelemetryOffMessage(usePrimaryManagedPolicy());
  return (
    <SettingsRow
      serverScoped
      {...searchableSetting("telemetry-opt-in")}
      settingKeys={["telemetryEnabled"]}
      description={
        managedOff ??
        text(
          "Off by default. When on, anonymous usage events (feature use, app version, operating system; no prompts, files or paths) are sent to ingest.t3.codes, a server run by the upstream T3 Code project. Turning it off stops sending at once and discards events not yet sent.",
        )
      }
      control={
        <ScopedSwitch
          settingKeys={["telemetryEnabled"]}
          checked={managedOff === undefined && settings.telemetryEnabled}
          disabled={managedOff !== undefined}
          onCheckedChange={(checked) => updateSettings({ telemetryEnabled: Boolean(checked) })}
          aria-label={text("Share anonymous usage data")}
        />
      }
    />
  );
}
