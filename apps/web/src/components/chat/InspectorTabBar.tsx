import { uiText } from "../../i18n";
import type { CSSProperties } from "react";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import type { InspectorTab } from "../../inspectorTabs";

export function InspectorTabBar({
  tabs,
  labels,
  value,
  onChange,
}: {
  tabs: readonly InspectorTab[];
  labels: Record<InspectorTab, string>;
  value: InspectorTab;
  onChange: (tab: InspectorTab) => void;
}) {
  const index = Math.max(0, tabs.indexOf(value));
  const sliderVars = {
    "--inspector-tab-count": tabs.length,
    "--inspector-tab-index": index,
  } as CSSProperties;
  return (
    // The pressed tab's surface is one shared slider that moves on change; tabs are equal width.
    <div
      className="relative mx-3 mt-3 mb-1 w-[calc(100%-1.5rem)]"
      data-inspector-tabs=""
      style={sliderVars}
    >
      <span aria-hidden data-inspector-tab-slider="" />
      <ToggleGroup
        aria-label={uiText("Inspector")}
        className={"relative w-full *:flex-1"}
        variant={"segmented"}
        value={[value]}
        onKeyDown={(event) => {
          if (event.altKey && event.key.toLowerCase() === "r" && tabs.includes("subtasks")) {
            event.preventDefault();
            onChange("subtasks");
          }
        }}
        onValueChange={(next) => {
          const tab = tabs.find((candidate) => candidate === next[0]);
          if (tab) onChange(tab);
        }}
      >
        {tabs.map((tab) => (
          <Toggle
            key={tab}
            value={tab}
            aria-keyshortcuts={tab === "subtasks" ? "Alt+R" : undefined}
          >
            {labels[tab]}
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  );
}
