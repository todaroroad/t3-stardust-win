import { expect, it } from "vite-plus/test";
import { render } from "../../../test/render";
import { Dialog, DialogPopup, DialogTitle } from "../ui/dialog";
import { applyThemePalette } from "../../themePalette";
import { UsageDetailsSheet } from "./UsageDetailsSheet";
import "~/index.css";
import "./usagePresentation.css";

it("places usage details above their parent route modal, with a 480 ms transition", async () => {
  const root = document.documentElement;
  const theme = root.getAttribute("data-theme-id");
  const style = root.getAttribute("style");
  try {
    applyThemePalette("apple", "light");
    await using screen = await render(
      <Dialog open>
        <DialogPopup>
          <DialogTitle>Usage</DialogTitle>
          <UsageDetailsSheet open onOpenChange={() => {}} title="Model details">
            <p>Real detail content</p>
          </UsageDetailsSheet>
        </DialogPopup>
      </Dialog>,
    );
    const sheet = document.querySelector<HTMLElement>("[data-usage-sheet]")!;
    for (const a of document.getAnimations()) a.finish();
    const r = sheet.getBoundingClientRect();
    expect(r.width).toBeGreaterThan(300);
    expect(sheet.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))).toBe(
      true,
    );
    expect(getComputedStyle(sheet).transitionDuration).toBe("0.48s");
    expect(getComputedStyle(sheet.querySelector(".usage-sheet-content")!).overscrollBehavior).toBe(
      "contain",
    );
    expect(getComputedStyle(sheet.closest('[data-slot="sheet-viewport"]')!).zIndex).toBe("500");
    expect(screen.container).toBeDefined();
  } finally {
    if (theme === null) root.removeAttribute("data-theme-id");
    else root.setAttribute("data-theme-id", theme);
    if (style === null) root.removeAttribute("style");
    else root.setAttribute("style", style);
  }
});
