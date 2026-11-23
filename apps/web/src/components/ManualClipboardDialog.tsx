import { uiText } from "../i18n";
import { useSyncExternalStore } from "react";
import { manualClipboard } from "../manualClipboard";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "./ui/dialog";

export function ManualClipboardDialog() {
  const value = useSyncExternalStore(
    manualClipboard.subscribe,
    manualClipboard.getSnapshot,
    () => null,
  );
  return (
    <Dialog
      open={value !== null}
      onOpenChange={(open) => {
        if (!open) manualClipboard.clear();
      }}
    >
      <DialogPopup>
        <DialogTitle>{uiText("Copy manually")}</DialogTitle>
        <DialogDescription>
          {uiText(
            "Your browser blocked automatic copying. Select or touch and hold the text below, then choose Copy.",
          )}
        </DialogDescription>
        <textarea
          aria-label={uiText("Text to copy")}
          readOnly
          value={value ?? ""}
          className="mt-3 max-h-[50dvh] min-h-32 w-full resize-none rounded-lg border bg-background p-3 text-base select-text"
          onFocus={(event) => event.currentTarget.select()}
        />
      </DialogPopup>
    </Dialog>
  );
}
