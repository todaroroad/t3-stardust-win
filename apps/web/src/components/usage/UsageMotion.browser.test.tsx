import { expect, it, vi } from "vite-plus/test";
import { render } from "../../../test/render";
import { UsageCount, UsageMotion } from "./UsageMotion";

const format = (n: number) => n.toFixed(1);
function Fixture({
  value,
  replay,
  dataKey,
}: {
  readonly value: number;
  readonly replay: string;
  readonly dataKey?: string;
}) {
  return (
    <UsageMotion replay={replay} {...(dataKey === undefined ? {} : { dataKey })}>
      <section data-usage-card>
        <UsageCount value={value} format={format} />
        <svg>
          <path data-usage-lines d="M0 0L20 20" />
          <rect data-usage-bar x="0" y="0" width="8" height="20" />
        </svg>
      </section>
    </UsageMotion>
  );
}
it("keeps cards stable through cached and fresh data while only digits animate", async () => {
  const spy = vi.spyOn(Element.prototype, "animate");
  try {
    await using screen = await render(<Fixture value={12.3} replay="cost:week:0" />);
    const card = screen.container.querySelector("[data-usage-card]")!;
    const line = screen.container.querySelector("[data-usage-lines]")!;
    const rect = card.getBoundingClientRect().toJSON();
    expect(spy.mock.contexts).toContain(line);
    const rise = spy.mock.calls.find(
      (call) =>
        typeof call[1] === "object" &&
        call[1]?.duration === 480 &&
        Array.isArray(call[0]) &&
        call[0][0]?.transform === "scaleY(0)",
    );
    expect(rise?.[0]).toEqual([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }]);
    expect(spy.mock.contexts).not.toContain(card);
    spy.mockClear();
    await screen.rerender(<Fixture value={14.2} replay="cost:week:0" />);
    expect(screen.container.querySelector("[data-usage-card]")).toBe(card);
    expect(card.getBoundingClientRect().toJSON()).toEqual(rect);
    expect(spy.mock.contexts).toHaveLength(2);
    expect(spy.mock.calls.map((call) => call[0])).toEqual([
      [{ transform: "translateY(-2em)" }, { transform: "translateY(-4em)" }],
      [{ transform: "translateY(-3em)" }, { transform: "translateY(-2em)" }],
    ]);
    expect(
      spy.mock.contexts.every((el) => el instanceof Element && el.hasAttribute("data-digit")),
    ).toBe(true);
    expect(spy.mock.contexts).not.toContain(line);
    spy.mockClear();
    await screen.rerender(<Fixture value={14.2} replay="cost:week:1" />);
    expect(spy.mock.contexts).toContain(line);
    expect(spy.mock.contexts).not.toContain(card);
    for (const animation of screen.container.getAnimations({ subtree: true })) animation.finish();
    expect(
      screen.container.getAnimations({ subtree: true }).filter((a) => a.playState === "running"),
    ).toHaveLength(0);
  } finally {
    spy.mockRestore();
  }
});
it("starts no data animation when reduced motion is requested", async () => {
  const media = vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  const spy = vi.spyOn(Element.prototype, "animate");
  try {
    await using screen = await render(<Fixture value={12.3} replay="cost:week:0" />);
    expect(spy).not.toHaveBeenCalled();
    expect(screen.container.querySelector(".usage-number")?.getAttribute("aria-label")).toBe(
      "12.3",
    );
  } finally {
    spy.mockRestore();
    media.mockRestore();
  }
});
it("a new period keeps the page in place: digits move from the old value and only the charts redraw", async () => {
  const spy = vi.spyOn(Element.prototype, "animate");
  try {
    await using screen = await render(<Fixture value={12.3} replay="cost:0" dataKey="7d" />);
    const card = screen.container.querySelector("[data-usage-card]")!;
    const line = screen.container.querySelector("[data-usage-lines]")!;
    const bar = screen.container.querySelector("[data-usage-bar]")!;
    spy.mockClear();
    // The user picks 30 days: the old figures stay until the new data arrives.
    await screen.rerender(<Fixture value={12.3} replay="cost:0" dataKey="7d" />);
    expect(spy).not.toHaveBeenCalled();
    await screen.rerender(<Fixture value={14.2} replay="cost:0" dataKey="30d" />);
    expect(screen.container.querySelector("[data-usage-card]")).toBe(card);
    expect(spy.mock.contexts).toContain(line);
    expect(spy.mock.contexts).toContain(bar);
    expect(spy.mock.contexts).not.toContain(card);
    const digits = spy.mock.calls.filter(
      (call) => Array.isArray(call[0]) && String(call[0][0]?.transform).startsWith("translateY"),
    );
    // Digits roll from the previous value, not from zero as on a fresh page.
    expect(digits.map((call) => call[0])).toEqual([
      [{ transform: "translateY(-2em)" }, { transform: "translateY(-4em)" }],
      [{ transform: "translateY(-3em)" }, { transform: "translateY(-2em)" }],
    ]);
  } finally {
    spy.mockRestore();
  }
});
