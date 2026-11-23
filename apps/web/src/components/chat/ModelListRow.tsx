import { uiText } from "~/i18n";


import { type ProviderDriverKind, type ProviderInstanceId } from "@t3tools/contracts";
import { T, useGT } from "gt-react";
import { memo } from "react";
import { StarIcon } from "lucide-react";
import { getDisplayModelName } from "./providerIconUtils";
import { ComboboxItem } from "../ui/combobox";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Kbd } from "../ui/kbd";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "~/lib/utils";
import "./composerV9.css";
import { modelPickerModelKey } from "./modelPickerKeys";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";

function V9CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export const ModelListRow = memo(function ModelListRow(props: {
  index: number;
  slug: string;
  name: string;
  subProvider?: string | undefined;
  instanceId: ProviderInstanceId;
  driverKind: ProviderDriverKind;
  providerDisplayName: string;
  providerAccentColor?: string | undefined;
  acpRegistryAgentId?: string | undefined;
  acpRegistryIconUrl?: string | undefined;
  isFavorite: boolean;
  /** In Favorites every row is starred, so the star shows only on hover. */
  favoriteStarOnHover?: boolean;
  isSelected: boolean;
  /** Marks this instance apart from another of the same provider. */
  showInstanceBadge: boolean;
  showNewBadge?: boolean;
  unavailable?: boolean;
  jumpLabel?: string | null;
  tierCount?: number | null;
  quotaLabel?: string | null;
  modelTagLabel?: string | null;
  quotaLow?: boolean;
  disabledReason?: string | null;
  onToggleFavorite: (instanceId: ProviderInstanceId, slug: string) => void;
}) {
  const gt = useGT();
  const model = {
    slug: props.slug,
    name: props.name,
    subProvider: props.subProvider,
  };

  const metaParts: string[] = [];
  if (props.tierCount && props.tierCount > 0) {
    metaParts.push(uiText("{count} levels", { count: props.tierCount }));
  }
  const trailingMeta = props.quotaLabel ?? props.modelTagLabel ?? null;
  if (trailingMeta) {
    metaParts.push(trailingMeta);
  }
  const metaText = metaParts.join(" · ");

  const row = (
    <ComboboxItem
      hideIndicator
      selectedFill={false}
      index={props.index}
      value={modelPickerModelKey(props.instanceId, props.slug)}
      disabled={Boolean(props.disabledReason)}
      data-v9-mp-item
      data-v9-selected={props.isSelected ? "true" : undefined}
      className={cn(
        "group relative w-full !min-w-0 max-w-full cursor-pointer",
        props.disabledReason &&
          "data-disabled:pointer-events-auto data-disabled:cursor-not-allowed",
      )}
    >
      <span data-v9-logo-chip aria-hidden="true">
        <ProviderInstanceIcon
          driverKind={props.driverKind}
          displayName={props.providerDisplayName}
          accentColor={props.providerAccentColor}
          acpRegistryAgentId={props.acpRegistryAgentId}
          acpRegistryIconUrl={props.acpRegistryIconUrl}
          showBadge={props.showInstanceBadge}
          className="size-3.5"
          iconClassName="size-3.5"
          indicatorBackground="var(--v9-logo-bg)"
          badgeClassName="right-[-0.125rem] bottom-[-0.125rem] h-2.5 min-w-2.5 px-0.5 text-5xs"
        />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span
          data-v9-mp-name
          onPointerEnter={(event) => {
            const name = event.currentTarget;
            name.title = name.scrollWidth > name.clientWidth ? getDisplayModelName(model) : "";
          }}
        >
          {getDisplayModelName(model)}
          <span className="sr-only">, {props.providerDisplayName}</span>
        </span>
        {props.subProvider ? (
          <span className="min-w-0 shrink truncate text-xs text-muted-foreground/70">
            {props.subProvider}
          </span>
        ) : null}
        {props.showNewBadge ? (
          <span
            className="shrink-0 rounded border border-update/35 bg-update/15 px-0.5 py-px text-3xs font-bold uppercase leading-none tracking-wide text-update-foreground"
            aria-label={gt("New model")}
          >
            {gt("New", { $context: "badge on a newly added model" })}
          </span>
        ) : null}
        {props.unavailable ? (
          <Badge variant="outline" size="sm">
            <T context="badge on a model that cannot be selected">Unavailable</T>
          </Badge>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-xs"
                variant="ghost-muted"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onToggleFavorite(props.instanceId, props.slug);
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                }}
                disabled={Boolean(props.disabledReason)}
                aria-label={
                  props.isFavorite ? uiText("Remove from favorites") : uiText("Add to favorites")
                }
                data-v9-mp-fav-btn
                className="size-5"
              >
                <StarIcon
                  className={cn("size-3", props.isFavorite && "fill-current text-warning")}
                />
              </Button>
            }
          />
          <TooltipPopup side="top" align="center">
            {props.isFavorite ? gt("Remove from favorites") : gt("Add to favorites")}
          </TooltipPopup>
        </Tooltip>
        {metaText ? (
          <span data-v9-mp-meta data-low={props.quotaLow ? "true" : undefined}>
            {metaText}
          </span>
        ) : null}
        {props.jumpLabel ? <Kbd>{props.jumpLabel}</Kbd> : null}
        {props.isSelected ? (
          <span data-v9-mp-check>
            <V9CheckIcon />
          </span>
        ) : null}
      </div>
    </ComboboxItem>
  );

  if (!props.disabledReason) {
    return row;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipPopup side="left" align="center">
        {props.disabledReason}
      </TooltipPopup>
    </Tooltip>
  );
});
