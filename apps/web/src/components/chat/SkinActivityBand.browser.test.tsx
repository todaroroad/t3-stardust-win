import { testUiLocale } from "../../../test/uiLocale";
import "~/index.css";
import { describe, expect, it, vi } from "vite-plus/test";
import { render, fakeTimers, act } from "../../../test/render";
import { SkinActivityBand } from "./SkinActivityBand";

const band = () => document.querySelector<HTMLElement>(".skin-activity-band");

describe("SkinActivityBand", () => {
  it("renders nothing while idle", async () => {
    await using _screen = await render(
      <SkinActivityBand working={false} subagentsSettled={0} subagentsTotal={0} />,
      { router: false },
    );
    expect(band()).toBeNull();
  });

  it("shows progress while working, then a check, then eases out and unmounts", async () => {
    using _locale = testUiLocale("zh-CN");
    await using screen = await render(
      <SkinActivityBand
        working
        activity="读取 README.md"
        subagentsSettled={1}
        subagentsTotal={3}
      />,
      { router: false },
    );
    await expect.poll(() => band()?.dataset.state).toBe("working");
    expect(band()!.textContent).toContain("读取 README.md");
    expect(document.querySelector(".skin-activity-rail")).toBeNull();
    expect(document.querySelector(".skin-activity-fx")).toBeNull();
    expect(document.querySelector(".skin-activity-count")?.textContent).toBe("1/3");
    // The glint moves pre-drawn layers with transforms only, so the text never repaints per frame.
    const glint = document.querySelector<HTMLElement>(".skin-activity-glint")!;
    expect(getComputedStyle(glint).animationName).toBe("skin-glint");
    expect(getComputedStyle(glint.firstElementChild!).animationName).toBe("skin-glint-counter");
    const label = document.querySelector<HTMLElement>(".skin-activity-label")!;
    expect(getComputedStyle(label).animationName).toBe("skin-line-in");
    expect(getComputedStyle(band()!).backdropFilter).toBe("none");

    await screen.rerender(
      <SkinActivityBand working={false} subagentsSettled={3} subagentsTotal={3} />,
    );
    await expect.poll(() => band()?.dataset.state).toBe("done");
    expect(band()!.textContent).toContain("完成");
    expect(document.querySelector(".skin-activity-glint")).toBeNull();
    await expect.poll(() => band()?.dataset.state, { timeout: 3000 }).toBe("leaving");
    await expect.poll(() => band(), { timeout: 3000 }).toBeNull();
  });
  it("coalesces rapid progress updates until the line hold elapses", async () => {
    await using screen = await render(
      <SkinActivityBand working activity="读取 A" subagentsSettled={0} subagentsTotal={0} />,
      { router: false },
    );
    using _timers = fakeTimers();
    try {
      await screen.rerender(
        <SkinActivityBand working activity="读取 B" subagentsSettled={0} subagentsTotal={0} />,
      );
      await act(() => vi.advanceTimersByTimeAsync(500));
      await screen.rerender(
        <SkinActivityBand working activity="读取 C" subagentsSettled={0} subagentsTotal={0} />,
      );
      expect(
        document.querySelector(".skin-activity-label")?.getAttribute("data-activity-text"),
      ).toBe("读取 A");
      await act(() => vi.advanceTimersByTimeAsync(1200));
      await expect
        .poll(() =>
          document.querySelector(".skin-activity-label")?.getAttribute("data-activity-text"),
        )
        .toBe("读取 C");
      expect(document.querySelector(".skin-activity-label")?.textContent).not.toContain("读取 B");
    } finally {
      vi.useRealTimers();
    }
  });
});
