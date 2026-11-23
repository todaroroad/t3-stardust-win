import { observeResize } from "./observeResize";

/** Only direct-child mutations measure and animate; idle lists have no position pollers. */
export function observeSidebarList(node: HTMLElement | null) {
  if (!node) return;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const animations = new Set<Animation>();
  const layoutTop = (element: HTMLElement) => {
    let top = 0;
    for (
      let current: HTMLElement | null = element;
      current;
      current = current.offsetParent as HTMLElement | null
    )
      top += current.offsetTop;
    return top;
  };
  const measure = () => {
    const origin = layoutTop(node);
    return new Map(
      Array.from(
        node.children,
        (child) => [child, layoutTop(child as HTMLElement) - origin] as const,
      ),
    );
  };
  let positions = measure();
  const cancel = () => {
    for (const animation of animations) animation.cancel();
    animations.clear();
  };
  const resized = () => {
    positions = measure();
  };
  let stopResize = observeResize(Array.from(node.children), resized);
  const observer = new MutationObserver(() => {
    const next = measure();
    cancel();
    if (!media.matches && document.visibilityState === "visible") {
      for (const [child, top] of next) {
        const before = positions.get(child);
        if (before === undefined || before === top || typeof child.animate !== "function") continue;
        try {
          const animation = child.animate(
            [{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }],
            { duration: 250, easing: "cubic-bezier(.2,.8,.2,1)" },
          );
          animations.add(animation);
          void animation.finished.then(
            () => animations.delete(animation),
            () => animations.delete(animation),
          );
        } catch {
          /* A missing animation backend must not prevent list updates. */
        }
      }
    }
    positions = next;
    stopResize();
    stopResize = observeResize(Array.from(node.children), resized);
  });
  observer.observe(node, { childList: true });
  media.addEventListener("change", cancel);
  document.addEventListener("visibilitychange", cancel);
  return () => {
    observer.disconnect();
    stopResize();
    cancel();
    media.removeEventListener("change", cancel);
    document.removeEventListener("visibilitychange", cancel);
  };
}
