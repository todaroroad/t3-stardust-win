const TOGGLE_THREAD_PANEL_EVENT = "t3:toggle-thread-panel";

/** The thread panel's inline/popover presentation lives in ChatView, so other surfaces ask it to toggle. */
export function requestToggleThreadPanel() {
  window.dispatchEvent(new Event(TOGGLE_THREAD_PANEL_EVENT));
}

export function onToggleThreadPanelRequest(listener: () => void) {
  window.addEventListener(TOGGLE_THREAD_PANEL_EVENT, listener);
  return () => window.removeEventListener(TOGGLE_THREAD_PANEL_EVENT, listener);
}

const OPEN_THREAD_PANEL_EVENT = "t3:open-thread-panel";
export function requestOpenThreadPanel() {
  window.dispatchEvent(new Event(OPEN_THREAD_PANEL_EVENT));
}
export function onOpenThreadPanelRequest(listener: () => void) {
  window.addEventListener(OPEN_THREAD_PANEL_EVENT, listener);
  return () => window.removeEventListener(OPEN_THREAD_PANEL_EVENT, listener);
}
