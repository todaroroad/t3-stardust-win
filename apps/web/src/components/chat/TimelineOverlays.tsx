import { T } from "gt-react";
import { useUiText } from "~/i18n/useUiText";

import { ArrowDownIcon, ChevronDownIcon, PaperclipIcon } from "lucide-react";

import { Button } from "../ui/button";

export function WorkspaceFileDropOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 bg-primary/[0.035]"
      data-chat-workspace-drop-overlay="true"
    >
      <div
        role="status"
        className="flex items-center gap-2 rounded-full border border-primary/25 bg-background/95 px-4 py-2.5 text-sm font-medium text-foreground shadow-lg"
      >
        <PaperclipIcon className="size-4 text-primary" aria-hidden="true" />
        <T>Drop files to attach</T>
      </div>
    </div>
  );
}
/**
 * Sits `bottom` pixels up, clear of the composer and its attached banners. The summary names
 * what waits at the end of the timeline, which is out of view while it shows.
 */
export function ScrollToEndButton(props: {
  readonly bottom: number;
  readonly summary: string | null;
  readonly onScrollToEnd: () => void;
}) {
  return (
    <div
      className="chat-scroll-to-bottom pointer-events-none absolute z-30 flex justify-center py-1.5"
      style={{ bottom: props.bottom }}
    >
      <Button
        data-scroll-to-end="true"
        onPointerDown={(event) => event.preventDefault()}
        onClick={props.onScrollToEnd}
        className="pointer-events-auto"
        size="xs"
        variant="glass"
      >
        <ChevronDownIcon className="size-3.5" />
        <T>Scroll to end</T>
        {props.summary === null ? null : (
          <span className="text-muted-foreground">
            <span aria-hidden>· </span>
            {props.summary}
          </span>
        )}
      </Button>
    </div>
  );
}

/**
 * 32px circular glass button anchored inside ComposerFloatAnchor so it shares coordinates with
 * the floating task capsule: centered when alone, smoothly docked to the composer right edge
 * aligned with the capsule header row when a capsule is visible.
 */
export function ScrollToEndCircleButton(props: {
  readonly show: boolean;
  readonly unread: boolean;
  readonly summary: string | null;
  readonly onScrollToEnd: () => void;
}) {
  const uiText = useUiText();
  const baseLabel = uiText("Jump to latest");
  const fullLabel = [
    baseLabel,
    props.unread ? uiText("New messages") : null,
    props.summary,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      data-scroll-to-end="true"
      data-show={props.show ? "true" : "false"}
      data-unread={props.unread ? "true" : "false"}
      tabIndex={props.show ? 0 : -1}
      aria-hidden={!props.show}
      aria-label={fullLabel}
      onPointerDown={(event) => event.preventDefault()}
      onClick={props.onScrollToEnd}
      className="scroll-end-button"
    >
      <ArrowDownIcon className="size-4" strokeWidth={1.8} aria-hidden="true" />
      {props.unread ? <span className="scroll-end-dot" aria-hidden="true" /> : null}
    </button>
  );
}
