import { GTProvider } from "gt-react";
import { describe, expect, it, vi } from "vite-plus/test";
import zh from "../../i18n/translations/zh.json";
import { render } from "../../../test/render";
import { TooltipProvider } from "../ui/tooltip";
import { ComposerAttachButton } from "./ComposerAttachButton";

describe("ComposerAttachButton", () => {
  it("renders V9 30x30 circular '+' button with aria-label and no native title", async () => {
    const addComposerAttachments = vi.fn().mockResolvedValue(true);
    const focusComposer = vi.fn();

    await using screen = await render(
      <GTProvider locale="zh" translations={{ zh, en: {} } as never}>
        <TooltipProvider>
          <ComposerAttachButton
            addComposerAttachments={addComposerAttachments}
            focusComposer={focusComposer}
          />
        </TooltipProvider>
      </GTProvider>,
    );

    const button = screen
      .getByRole("button", { name: "添加附件" })
      .element() as HTMLButtonElement;
    expect(button.hasAttribute("title")).toBe(false);
    expect(button.getAttribute("data-v9-sf-btn")).toBe("attach");
    const rect = button.getBoundingClientRect();
    expect(Math.round(rect.width)).toBe(30);
    expect(Math.round(rect.height)).toBe(30);

    const svg = button.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("stroke-width")).toBe("1.8");
    expect(svg!.getAttribute("stroke-linecap")).toBe("round");
  });

  it("opens the hidden file input on click and forwards both image and ordinary files into the attachment pipeline", async () => {
    const addComposerAttachments = vi.fn().mockResolvedValue(true);
    const focusComposer = vi.fn();

    await using screen = await render(
      <GTProvider locale="zh" translations={{ zh, en: {} } as never}>
        <TooltipProvider>
          <ComposerAttachButton
            addComposerAttachments={addComposerAttachments}
            focusComposer={focusComposer}
          />
        </TooltipProvider>
      </GTProvider>,
    );

    const input = screen.container.querySelector<HTMLInputElement>(
      'input[data-composer-attach-input="true"]',
    );
    expect(input).not.toBeNull();
    expect(input!.type).toBe("file");
    expect(input!.multiple).toBe(true);
    expect(input!.accept).toBe("");

    const clickSpy = vi.spyOn(input!, "click").mockImplementation(() => {});
    await screen.getByRole("button", { name: "添加附件" }).click();
    expect(clickSpy).toHaveBeenCalledOnce();

    const image = new File(["png-bytes"], "screenshot.png", { type: "image/png" });
    const text = new File(["hello"], "notes.md", { type: "text/markdown" });
    const transfer = new DataTransfer();
    transfer.items.add(image);
    transfer.items.add(text);
    input!.files = transfer.files;
    input!.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => expect(addComposerAttachments).toHaveBeenCalledOnce());
    const forwarded = addComposerAttachments.mock.calls[0]![0] as File[];
    expect(forwarded.map((file) => file.name)).toEqual(["screenshot.png", "notes.md"]);
    expect(focusComposer).not.toHaveBeenCalled();
  });

  it("refocuses composer when addComposerAttachments does not insert a chip and respects disabled state", async () => {
    const addComposerAttachments = vi.fn().mockResolvedValue(false);
    const focusComposer = vi.fn();

    await using screen = await render(
      <GTProvider locale="zh" translations={{ zh, en: {} } as never}>
        <TooltipProvider>
          <ComposerAttachButton
            addComposerAttachments={addComposerAttachments}
            focusComposer={focusComposer}
          />
        </TooltipProvider>
      </GTProvider>,
    );

    const input = screen.container.querySelector<HTMLInputElement>(
      'input[data-composer-attach-input="true"]',
    )!;
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "a.txt", { type: "text/plain" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => expect(focusComposer).toHaveBeenCalledOnce());

    await screen.rerender(
      <GTProvider locale="zh" translations={{ zh, en: {} } as never}>
        <TooltipProvider>
          <ComposerAttachButton
            addComposerAttachments={addComposerAttachments}
            focusComposer={focusComposer}
            disabled
          />
        </TooltipProvider>
      </GTProvider>,
    );
    const button = screen
      .getByRole("button", { name: "添加附件" })
      .element() as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
