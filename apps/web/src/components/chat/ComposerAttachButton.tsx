import { useRef } from "react";

import { useUiText } from "~/i18n/useUiText";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import "./composerV9.css";

function V9PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** V9 circular "+" attachment button; opens the system file picker and feeds the draft intake pipeline. */
export function ComposerAttachButton({
  addComposerAttachments,
  focusComposer,
  disabled = false,
}: {
  readonly addComposerAttachments: (files: File[]) => Promise<boolean>;
  readonly focusComposer: () => void;
  readonly disabled?: boolean;
}) {
  const uiText = useUiText();
  const inputRef = useRef<HTMLInputElement>(null);
  const ariaLabel = uiText("Add attachment");
  const tooltipLabel = uiText("Upload file or image");

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        data-composer-attach-input="true"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length === 0) return;
          // Inserting a chip refocuses the editor after the draft renders;
          // focusing synchronously here would report the editor's stale text
          // over the prompt that was just written.
          void addComposerAttachments(files).then((inserted) => {
            if (!inserted) focusComposer();
          });
        }}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              data-v9-sf-btn="attach"
              data-composer-attach-btn="true"
              disabled={disabled}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                if (!disabled) inputRef.current?.click();
              }}
              aria-label={ariaLabel}
            />
          }
        >
          <V9PlusIcon />
        </TooltipTrigger>
        <TooltipPopup side="top">{tooltipLabel}</TooltipPopup>
      </Tooltip>
    </>
  );
}
