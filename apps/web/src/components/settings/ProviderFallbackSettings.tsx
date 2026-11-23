import { uiText } from "../../i18n";
import {
  resolveProviderInstanceEnabled,
  type ProviderInstanceConfig,
  type ProviderInstanceId,
  type ServerSettings,
  type ServerSettingsPatch,
} from "@t3tools/contracts";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { FoldedSettingsSection } from "./FoldedSettingsSection";
import { SettingsRow } from "./settingsLayout";

export function ProviderFallbackSettings({
  settings,
  instances,
  selectedInstanceId,
  canWriteSettings,
  canManageProviders,
  onUpdate,
  onUpdateInstance,
}: {
  readonly settings: Pick<ServerSettings, "providerFallbackEnabled" | "providerFallbackChains">;
  readonly instances: ReadonlyArray<{
    readonly instanceId: ProviderInstanceId;
    readonly label: string;
    readonly instance: ProviderInstanceConfig;
  }>;
  readonly selectedInstanceId?: ProviderInstanceId | undefined;
  readonly canWriteSettings: boolean;
  readonly canManageProviders: boolean;
  readonly onUpdate: (patch: ServerSettingsPatch) => void;
  readonly onUpdateInstance: (id: ProviderInstanceId, instance: ProviderInstanceConfig) => void;
}) {
  const [selected, setSelected] = useState<ProviderInstanceId | null>(null);
  const source =
    instances.find((instance) => instance.instanceId === selected) ??
    instances.find((instance) => instance.instanceId === selectedInstanceId) ??
    instances[0];
  const chain =
    source === undefined ? [] : (settings.providerFallbackChains[source.instanceId] ?? []);
  const label = (id: ProviderInstanceId) =>
    instances.find((instance) => instance.instanceId === id)?.label ?? id;
  const updateChain = (next: ReadonlyArray<ProviderInstanceId>) => {
    if (source === undefined) return;
    onUpdate({
      providerFallbackChains: { ...settings.providerFallbackChains, [source.instanceId]: next },
    });
  };
  const available = instances.filter(
    ({ instanceId, instance }) =>
      instanceId !== source?.instanceId &&
      !chain.includes(instanceId) &&
      resolveProviderInstanceEnabled(instance),
  );
  const move = (index: number, offset: number) => {
    const next = [...chain];
    [next[index], next[index + offset]] = [next[index + offset]!, next[index]!];
    updateChain(next);
  };
  return (
    <FoldedSettingsSection
      id="provider-fallback"
      title={uiText("Switch providers when quota runs out")}
      summary={settings.providerFallbackEnabled ? uiText("Turn on") : uiText("Switch off")}
      control={
        <Switch
          aria-label={uiText("Switch providers when quota runs out")}
          checked={settings.providerFallbackEnabled}
          disabled={!canWriteSettings}
          onCheckedChange={(providerFallbackEnabled) => onUpdate({ providerFallbackEnabled })}
        />
      }
    >
      <p className="px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
        {uiText(
          "Retries the current message only on quota or rate limits, then stays on the new provider. The handoff uses existing history, subject to context limits.",
        )}
      </p>
      {source ? (
        <>
          <SettingsRow
            title={uiText("Current provider")}
            description={uiText(
              "Set a fallback order for each provider. If the same model is unavailable, use the fallback provider’s default.",
            )}
          >
            <Select
              value={source.instanceId}
              items={instances.map(({ instanceId, label }) => ({ value: instanceId, label }))}
              onValueChange={setSelected}
            >
              <SelectTrigger aria-label={uiText("Source for fallback providers")}>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {instances.map(({ instanceId, label, instance }) => (
                  <SelectItem key={instanceId} value={instanceId}>
                    {label}
                    {instance.billingMode === "metered" ? uiText(" · Usage-based billing") : ""}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </SettingsRow>
          <SettingsRow
            title={uiText("Usage-based billing")}
            description={uiText(
              "Mark {label} as a paid API to show billing information when choosing a fallback.",
              { label: source.label },
            )}
          >
            <Switch
              aria-label={uiText("{label} usage-based billing", { label: source.label })}
              checked={source.instance.billingMode === "metered"}
              disabled={!canManageProviders}
              onCheckedChange={(metered) =>
                onUpdateInstance(source.instanceId, {
                  ...source.instance,
                  billingMode: metered ? "metered" : "subscription",
                })
              }
            />
          </SettingsRow>
          {chain.map((id, index) => (
            <SettingsRow
              key={id}
              title={
                <span className="inline-flex items-center gap-2">
                  <span className="text-muted-foreground">{index + 1}.</span> {label(id)}
                  {instances.find((instance) => instance.instanceId === id)?.instance
                    .billingMode === "metered" ? (
                    <Badge variant="warning" size="sm">
                      {uiText("Usage-based billing")}
                    </Badge>
                  ) : null}
                </span>
              }
            >
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost-muted"
                  size="icon-xs"
                  aria-label={uiText("Move {count} up", { count: label(id) })}
                  disabled={!canWriteSettings || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  variant="ghost-muted"
                  size="icon-xs"
                  aria-label={uiText("Move {count} down", { count: label(id) })}
                  disabled={!canWriteSettings || index === chain.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  variant="ghost-muted"
                  size="icon-xs"
                  aria-label={uiText("Remove {count}", { count: label(id) })}
                  disabled={!canWriteSettings}
                  onClick={() => updateChain(chain.filter((_, i) => i !== index))}
                >
                  <XIcon />
                </Button>
              </div>
            </SettingsRow>
          ))}
          <SettingsRow
            title={
              chain.length === 0
                ? uiText("No fallback providers configured")
                : uiText("Add fallback provider")
            }
            description={uiText(
              "Tries each provider once per turn in order. If all fail, the original error is kept.",
            )}
          >
            <Select<ProviderInstanceId>
              value={null}
              items={available.map(({ instanceId, label, instance }) => ({
                value: instanceId,
                label: `${label}${instance.billingMode === "metered" ? uiText(" · Usage-based billing") : ""}`,
              }))}
              disabled={!canWriteSettings || available.length === 0}
              onValueChange={(id) => {
                if (id !== null) updateChain([...chain, id]);
              }}
            >
              <SelectTrigger aria-label={uiText("Add fallback provider")}>
                <SelectValue placeholder={uiText("Select fallback provider")} />
              </SelectTrigger>
              <SelectPopup>
                {available.map(({ instanceId, label, instance }) => (
                  <SelectItem key={instanceId} value={instanceId}>
                    {label}
                    {instance.billingMode === "metered" ? uiText(" · Usage-based billing") : ""}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </SettingsRow>
        </>
      ) : null}
    </FoldedSettingsSection>
  );
}
