import { useLayoutEffect, useRef, useState } from "react";
import { useUiText } from "~/i18n/useUiText";

import { Toolbar } from "@base-ui/react/toolbar";
import { type ProviderInstanceId } from "@t3tools/contracts";
import { memo } from "react";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "~/lib/utils";
import "./composerV9.css";
import {
  isProviderInstancePickerReady,
  shouldShowInstanceBadge,
  type ProviderInstanceEntry,
} from "../../providerInstances";

export type ModelPickerTabId = ProviderInstanceId | "favorites" | "all";

function describeUnavailableInstance(entry: ProviderInstanceEntry): string {
  const label = entry.displayName;
  // An unavailable instance (a driver this build lacks or the policy leaves out) says why instead.
  if ((!entry.enabled && entry.isAvailable) || entry.status === "disabled") {
    return `${label}: Disabled in settings.`;
  }
  if (entry.status === "ready" && entry.isAvailable) {
    return label;
  }
  const kind =
    entry.status === "error" ? "Unavailable" : entry.status === "warning" ? "Limited" : "Not ready";
  const msg = entry.snapshot.message?.trim();
  return msg ? `${label}: ${kind}. ${msg}` : `${label}: ${kind}.`;
}

export const ModelPickerSidebar = memo(function ModelPickerSidebar(props: {
  selectedInstanceId: ModelPickerTabId;
  onSelectInstance: (instanceId: ModelPickerTabId) => void;
  onFocusSearch: () => void;
  instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  showFavorites?: boolean;
  showAll?: boolean;
  disabledInstanceIds?: ReadonlySet<ProviderInstanceId>;
  selectableUnavailableInstanceIds?: ReadonlySet<ProviderInstanceId>;
  getDisabledInstanceTooltip?: (entry: ProviderInstanceEntry) => string;
}) {
  const uiText = useUiText();
  const handleSelect = (instanceId: ModelPickerTabId) => {
    props.onSelectInstance(instanceId);
  };
  const showFavorites = props.showFavorites ?? true;
  const showAll = props.showAll ?? true;
  const [hoveredInstanceId, setHoveredInstanceId] = useState<ProviderInstanceId | null>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const [selectedIndicatorTop, setSelectedIndicatorTop] = useState<number | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads the selected provider item's DOM offset to position the selection indicator
  useLayoutEffect(() => {
    const content = sidebarContentRef.current;
    if (!content) {
      return;
    }
    const selectedItem = Array.from(
      content.querySelectorAll<HTMLElement>("[data-model-picker-provider]"),
    ).find((item) => item.dataset.modelPickerProvider === props.selectedInstanceId);
    if (!selectedItem) {
      setSelectedIndicatorTop(null);
      return;
    }
    setSelectedIndicatorTop(selectedItem.offsetTop + selectedItem.offsetHeight / 2 - 10);
  }, [
    // Adding, removing or reordering providers moves the selected item, so the indicator re-measures.
    props.instanceEntries,
    props.selectedInstanceId,
    showFavorites,
  ]);

  return (
    <Toolbar.Root
      data-model-picker-sidebar="true"
      data-v9-mp-tabs
      aria-label={uiText("Providers")}
      orientation="horizontal"
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          props.onFocusSearch();
        }
      }}
    >
      {showFavorites ? (
        <Toolbar.Button
          data-model-picker-provider="favorites"
          data-v9-mp-tab
          type="button"
          aria-pressed={props.selectedInstanceId === "favorites"}
          onClick={() => handleSelect("favorites")}
        >
          <span>{uiText("Frequent")}</span>
        </Toolbar.Button>
      ) : null}

      {showAll ? (
        <Toolbar.Button
          data-model-picker-provider="all"
          data-v9-mp-tab
          type="button"
          aria-pressed={props.selectedInstanceId === "all"}
          onClick={() => handleSelect("all")}
        >
          <span>{uiText("All")}</span>
        </Toolbar.Button>
      ) : null}

      {props.instanceEntries.map((entry) => {
        const isUnavailable = !isProviderInstancePickerReady(entry);
        const isContextDisabled = props.disabledInstanceIds?.has(entry.instanceId) ?? false;
        const unavailableSelectionIsReachable =
          props.selectableUnavailableInstanceIds?.has(entry.instanceId) ?? false;
        const isDisabled = (isUnavailable && !unavailableSelectionIsReachable) || isContextDisabled;
        const isSelected = props.selectedInstanceId === entry.instanceId;
        const showInstanceBadge = shouldShowInstanceBadge(entry, props.instanceEntries);

        const tooltip = isUnavailable
          ? describeUnavailableInstance(entry)
          : isContextDisabled
            ? (props.getDisabledInstanceTooltip?.(entry) ?? entry.displayName)
            : null;

        const button = (
          <Toolbar.Button
            key={entry.instanceId}
            data-model-picker-provider={entry.instanceId}
            data-provider-accent-color={entry.accentColor}
            data-v9-mp-tab
            type="button"
            disabled={isDisabled}
            focusableWhenDisabled={!isDisabled}
            aria-pressed={isSelected}
            aria-label={tooltip ?? entry.displayName}
            onClick={() => !isDisabled && handleSelect(entry.instanceId)}
          >
            <ProviderInstanceIcon
              driverKind={entry.driverKind}
              displayName={entry.displayName}
              accentColor={entry.accentColor}
              acpRegistryAgentId={entry.acpRegistryAgentId}
              acpRegistryIconUrl={entry.acpRegistryIconUrl}
              showBadge={showInstanceBadge}
              size="compact"
              className="size-3"
              iconClassName={cn("size-3")}
            />
            <span>{entry.displayName}</span>
          </Toolbar.Button>
        );

        if (!tooltip) {
          return button;
        }

        return (
          <Tooltip key={entry.instanceId}>
            <TooltipTrigger
              render={isDisabled ? <span className="inline-flex shrink-0">{button}</span> : button}
            />
            <TooltipPopup side="top" align="center">
              {tooltip}
            </TooltipPopup>
          </Tooltip>
        );
      })}
    </Toolbar.Root>
  );
});
