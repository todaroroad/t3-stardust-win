import type { StorageTidySettings } from "@t3tools/contracts";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { useUiText } from "~/i18n/useUiText";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { SettingsRow, SettingsSection } from "../settings/settingsLayout";

export function StorageTidySettingsSection({
  settings,
  rescueRoot,
  disabled,
  error,
  onChange,
}: {
  readonly settings: StorageTidySettings;
  readonly rescueRoot: string;
  readonly disabled: boolean;
  readonly error: string | null;
  readonly onChange: (patch: Partial<StorageTidySettings>) => void;
}) {
  const t = useUiText();
  const [draft, setDraft] = useState(settings.buildDirectory);
  const [baseline, setBaseline] = useState(settings.buildDirectory);
  // Follow the saved value when it changes elsewhere, without touching a draft being typed.
  if (baseline !== settings.buildDirectory) {
    setBaseline(settings.buildDirectory);
    setDraft(settings.buildDirectory);
  }
  const dirty = draft.trim() !== settings.buildDirectory;
  return (
    <SettingsSection id="storage-tidy-settings" title={t("Cleanup preferences")}>
      <SettingsRow
        id="storage-tidy-rescue"
        title={t("Rescue first, then clean")}
        description={t("Before worktrees and backup folders are removed, copy their screenshots, previews, components and uncommitted changes to {path}.", { path: rescueRoot })}
        control={
          <Switch
            checked={settings.rescueFirst}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ rescueFirst: checked })}
            aria-label={t("Rescue first, then clean")}
          />
        }
      />
      <SettingsRow
        id="storage-tidy-keep"
        title={t("Keep the newest rollback copies")}
        description={t("Old app copies, .bak-pre-* and .orig files, and older builds in My build folder: keep this many per source.")}
        control={
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            <Button size="icon-xs" variant="ghost" aria-label={t("Keep fewer")} disabled={disabled || settings.keepNewest <= 1} onClick={() => onChange({ keepNewest: settings.keepNewest - 1 })}>
              <MinusIcon />
            </Button>
            <span className="w-6 text-center text-sm tabular-nums" data-testid="keep-newest">{settings.keepNewest}</span>
            <Button size="icon-xs" variant="ghost" aria-label={t("Keep more")} disabled={disabled || settings.keepNewest >= 20} onClick={() => onChange({ keepNewest: settings.keepNewest + 1 })}>
              <PlusIcon />
            </Button>
          </div>
        }
      />
      <SettingsRow
        id="storage-tidy-build-directory"
        title={t("My build folder")}
        description={
          error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            t("A folder of old build generations, for example c97-build, c98-build. Leave it empty to skip builds.")
          )
        }
        control={
          <form
            className="flex w-80 max-w-full items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onChange({ buildDirectory: draft.trim() });
            }}
          >
            <Input
              value={draft}
              disabled={disabled}
              font="mono"
              size="sm"
              placeholder="/Volumes/Disk/builds"
              aria-label={t("My build folder")}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" size="xs" variant="outline" disabled={disabled || !dirty}>
              {t("Save")}
            </Button>
          </form>
        }
      />
    </SettingsSection>
  );
}
