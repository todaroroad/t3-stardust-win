import type { ContextMenuSource } from "@t3tools/contracts";

// Keyboard context menus use -1 on Linux and 0 on current macOS Chromium; right clicks use 2.
// Keyboard activation of buttons has zero clicks.
export function contextMenuSourceOf(
  event: Pick<MouseEvent, "type" | "button" | "detail">,
): ContextMenuSource {
  return (event.type === "click" ? event.detail === 0 : event.button <= 0) ? "keyboard" : "mouse";
}
