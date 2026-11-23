import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { ToggleGroup } from "../ui/toggle-group";
import { observeResize } from "~/lib/observeResize";
export function UsageSegments(props: ComponentProps<typeof ToggleGroup>) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef<{ left: number; width: number } | null>(null);
  const selection = JSON.stringify(props.value);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- aligns the shared selection surface with the active segment and observes responsive geometry
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    el.dataset.selection = selection;
    let animation: Animation | undefined;
    const update = () => {
      const selected = el.querySelector<HTMLElement>("[data-slot=toggle][data-pressed]");
      const thumb = el.querySelector<HTMLElement>("[data-usage-thumb]");
      if (!selected || !thumb) return;
      const next = { left: selected.offsetLeft, width: selected.offsetWidth };
      const old = previous.current;
      thumb.style.width = `${next.width}px`;
      thumb.style.transform = `translateX(${next.left}px)`;
      thumb.style.opacity = "1";
      animation?.cancel();
      if (
        old &&
        old.width > 0 &&
        next.width > 0 &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        animation = thumb.animate(
          [
            { transform: `translateX(${old.left}px) scaleX(${old.width / next.width})` },
            { transform: `translateX(${next.left}px) scaleX(1)` },
          ],
          { duration: 380, easing: "cubic-bezier(.32,.72,0,1)" },
        );
      previous.current = next;
    };
    update();
    const stop = observeResize(el, update);
    return () => {
      stop();
      animation?.cancel();
    };
  }, [selection]);
  return (
    <div ref={root} data-usage-segments className="relative inline-flex shrink-0">
      <span
        data-usage-thumb
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0 origin-left rounded-md bg-background opacity-0 shadow-sm"
      />
      <ToggleGroup {...props} />
    </div>
  );
}
