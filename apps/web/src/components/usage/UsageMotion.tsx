import { createContext, use, useEffect, useRef, type ReactNode } from "react";
const UsageReplay = createContext({ key: "", delay: 0 });
export function UsageMotion({
  children,
  replay,
  dataKey,
  delayMs = 0,
}: {
  readonly children: ReactNode;
  readonly replay: string;
  /** Changes when other data (another period) is shown: only the charts redraw, the page stays. */
  readonly dataKey?: string;
  readonly delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shownData = useRef(dataKey);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- redraws the charts once when another period's data is shown; cancels on unmount
  useEffect(() => {
    const root = ref.current;
    const before = shownData.current;
    shownData.current = dataKey;
    if (!root || before === undefined || before === dataKey) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ease = "cubic-bezier(.22,.8,.2,1)";
    const animations: Animation[] = [];
    root.querySelectorAll<HTMLElement>("[data-usage-bar]").forEach((el, i) =>
      animations.push(
        el.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
          duration: 420,
          delay: Math.min(i, 30) * 8,
          easing: ease,
        }),
      ),
    );
    root.querySelectorAll<HTMLElement>("[data-usage-lines]").forEach((el) =>
      animations.push(
        el.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
          duration: 420,
          easing: ease,
        }),
      ),
    );
    return () => animations.forEach((a) => a.cancel());
  }, [dataKey]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- replays finite presentation animations on explicit navigation and refresh; cancels on unmount
  useEffect(() => {
    const root = ref.current;
    if (root) root.dataset.usageReplay = replay;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ease = "cubic-bezier(.22,.8,.2,1)";
    const animations: Animation[] = [];
    const play = (selector: string, frames: Keyframe[], duration: number, stagger = 0) =>
      root.querySelectorAll<HTMLElement>(selector).forEach((el, i) =>
        animations.push(
          el.animate(frames, {
            duration,
            delay: delayMs + Math.min(i, 30) * stagger,
            easing: ease,
          }),
        ),
      );
    root.querySelectorAll<SVGCircleElement>("[data-usage-ring]").forEach((el) => {
      animations.push(
        el.animate([{ strokeDashoffset: "100" }, { strokeDashoffset: "0" }], {
          duration: 480,
          delay: delayMs,
          easing: ease,
        }),
      );
    });
    play(".usage-grow", [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 400, 16);
    play("[data-usage-bar]", [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], 480, 12);
    play(
      "[data-usage-lines]",
      [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      480,
    );
    play(
      "[data-usage-pace]",
      [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }],
      480,
    );
    play(
      "[data-reset-point]",
      [
        { opacity: 0, transform: "scale(.4)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      400,
      7,
    );
    return () => animations.forEach((a) => a.cancel());
  }, [replay, delayMs]);
  return (
    <UsageReplay value={{ key: replay, delay: delayMs }}>
      <div ref={ref} className="usage-motion">
        {children}
      </div>
    </UsageReplay>
  );
}
export function UsageCount({
  value,
  format,
}: {
  readonly value: number;
  readonly format: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const replay = use(UsageReplay);
  const formatted = format(value);
  const previous = useRef<{ formatted: string; replay: string } | null>(null);
  const columns = [...formatted].map((char, index) => ({ char, place: formatted.length - index }));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- finite digit-column animations react to a value or explicit user replay and cancel on unmount
  useEffect(() => {
    const root = ref.current;
    const old = previous.current;
    previous.current = { formatted, replay: replay.key };
    if (!root) return;
    root.dataset.usageReplay = replay.key;
    root.dataset.usageValue = formatted;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const replayed = !old || old.replay !== replay.key;
    const animations: Animation[] = [];
    [...root.querySelectorAll<HTMLElement>("[data-digit]")].forEach((el, index) => {
      const place = Number(el.dataset.place);
      const before = old?.formatted.at(-place);
      const digit = el.dataset.digit;
      if (!replayed && before === digit) return;
      const start = replayed ? "0" : before && /[0-9]/.test(before) ? before : digit;
      if (start === digit) return;
      animations.push(
        el.animate(
          [{ transform: `translateY(-${start}em)` }, { transform: `translateY(-${digit}em)` }],
          {
            duration: 480,
            delay: replayed ? replay.delay + index * 35 : 0,
            easing: "cubic-bezier(.16,.84,.24,1)",
            fill: "backwards",
          },
        ),
      );
    });
    return () => animations.forEach((a) => a.cancel());
  }, [formatted, replay.key, replay.delay, ref, previous]);
  return (
    <span className="usage-number" aria-label={formatted} ref={ref}>
      <span aria-hidden className="usage-digit-row">
        {columns.map(({ char, place }) =>
          /[0-9]/.test(char) ? (
            <span className="usage-digit" key={place}>
              <span
                data-digit={char}
                data-place={place}
                style={{ transform: `translateY(-${char}em)` }}
              >
                {Array.from({ length: 10 }, (_, n) => (
                  <span key={n}>{n}</span>
                ))}
              </span>
            </span>
          ) : (
            <span key={place}>{char}</span>
          ),
        )}
      </span>
    </span>
  );
}
