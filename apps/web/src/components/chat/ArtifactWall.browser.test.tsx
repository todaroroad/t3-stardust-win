import { testUiLocale } from "../../../test/uiLocale";
import "~/index.css";
import type { EnvironmentId, ThreadId, WallArtifact } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { act, render } from "../../../test/render";
import { ArtifactWall } from "./ArtifactWall";
import { loadWallArtifacts } from "../../lib/artifactWallClient";

const ARTIFACTS = vi.hoisted(() => {
  const make = (id: string, name: string, extension: string, kind: string) => ({
    id,
    path: `/work/${name}`,
    name,
    extension,
    kind,
    source: "path_reference",
    createdAt: "2026-10-25T08:00:00.000Z",
    sizeBytes: 2048,
  });
  return [
    make("a1", "cover.png", "png", "image"),
    make("a2", "demo.mov", "mov", "video"),
    make("a3", "clip.mp4", "mp4", "video"),
    make("a4", "notes.md", "md", "document"),
    make("a5", "index.html", "html", "page"),
  ] as unknown as WallArtifact[];
});

vi.mock("../../lib/artifactWallClient", () => ({
  artifactFileUrl: () => null,
  fileFromArtifact: vi.fn(),
  loadWallArtifacts: vi.fn(async () => ARTIFACTS),
}));
vi.mock("../../state/session", async (original) => ({
  ...(await original<typeof import("../../state/session")>()),
  usePreparedConnection: () => null,
}));
vi.mock("../../state/use-atom-command", () => ({ useAtomCommand: () => vi.fn() }));
// The thread's latest run began when the fixtures were written, so they count as new.
vi.mock("../../state/entities", async (original) => ({
  ...(await original<typeof import("../../state/entities")>()),
  useQuietThreadShell: () => ({
    latestRun: { startedAt: "2026-10-25T08:00:00.000Z", requestedAt: null },
  }),
}));

describe("ArtifactWall video filter", () => {
  it("lists video after images and filters to video artifacts", async () => {
    using _locale = testUiLocale("zh-CN");
    await using screen = await render(
      <ArtifactWall
        environmentId={"environment-local" as EnvironmentId}
        threadId={"thread-1" as ThreadId}
        onAttach={vi.fn()}
      />,
      // The wall only needs the mocked client; no routes are involved.
      { router: false },
    );
    const chips = await vi.waitFor(() => {
      const found = [
        ...screen.container.querySelectorAll<HTMLButtonElement>('[aria-label="产物类型"] button'),
      ];
      expect(found.map((chip) => chip.textContent)).toContain("视频 2");
      return found;
    });
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "全部 5",
      "图片 1",
      "视频 2",
      "页面 1",
      "文档 1",
    ]);
    chips.find((chip) => chip.textContent === "视频 2")!.click();
    await vi.waitFor(() => {
      expect(
        [...screen.container.querySelectorAll("[data-artifact-id]")].map((n) =>
          n.getAttribute("data-artifact-id"),
        ),
      ).toEqual(["a2", "a3"]);
      expect(screen.container.textContent).not.toContain("notes.md");
    });
  });

  it("lists every artifact as a row with a thumbnail or type and marks this run's output", async () => {
    using _locale = testUiLocale("zh-CN");
    const older = {
      ...ARTIFACTS[3]!,
      id: "a0",
      name: "old.md",
      path: "/work/old.md",
      createdAt: "2026-10-25T07:00:00.000Z",
    };
    vi.mocked(loadWallArtifacts).mockResolvedValueOnce([...ARTIFACTS, older]);
    await using screen = await render(
      <ArtifactWall
        environmentId={"environment-local" as EnvironmentId}
        threadId={"thread-1" as ThreadId}
        onAttach={vi.fn()}
      />,
      { router: false },
    );
    await vi.waitFor(() => {
      expect(screen.container.querySelectorAll("li[data-artifact-id]").length).toBe(6);
    });
    const row = (id: string) =>
      screen.container.querySelector<HTMLElement>(`li[data-artifact-id="${id}"]`)!;
    expect(row("a1").querySelector("img")).not.toBeNull();
    expect(row("a4").querySelector("img")).toBeNull();
    expect(row("a4").textContent).toContain("MD");
    expect(row("a4").textContent).toContain("新");
    expect(row("a0").textContent).not.toContain("新");
    // The preview card shows the newest image with its two actions and the check note.
    const card = screen.container.querySelector<HTMLElement>("[data-artifact-featured]")!;
    expect(card.getAttribute("data-artifact-featured")).toBe("a1");
    expect(card.textContent).toContain("文件存在不代表检查通过");
    // Check status is hover text now, not row text.
    expect(screen.container.textContent).not.toContain("未附检查记录");
  });

  it("renders nothing while inactive but still reports the artifact count", async () => {
    const onCount = vi.fn();
    await using screen = await render(
      <ArtifactWall
        environmentId={"environment-local" as EnvironmentId}
        threadId={"thread-1" as ThreadId}
        onAttach={vi.fn()}
        active={false}
        onCount={onCount}
      />,
      { router: false },
    );
    await vi.waitFor(() => expect(onCount).toHaveBeenCalledWith(5));
    expect(screen.container.querySelector("[data-artifact-wall]")).toBeNull();
  });
});

describe("ArtifactWall revision drafts", () => {
  it("hides feedback by default and preserves the draft when its visibility is toggled", async () => {
    using _locale = testUiLocale("zh-CN");
    const props = {
      environmentId: "environment-local" as EnvironmentId,
      threadId: "thread-1" as ThreadId,
      onAttach: vi.fn(),
      onRevise: vi.fn(() => true),
    };
    await using screen = await render(<ArtifactWall {...props} />, { router: false });
    await screen.getByRole("button", { name: "查看 cover.png", exact: true }).click();
    await expect.element(screen.getByRole("textbox", { name: "修改意见" })).not.toBeInTheDocument();
    await screen.rerender(<ArtifactWall {...props} revisionEnabled />);
    await screen.getByRole("textbox", { name: "修改意见" }).fill("保留构图，只调整边缘");
    await screen.rerender(<ArtifactWall {...props} revisionEnabled={false} />);
    await expect.element(screen.getByRole("textbox", { name: "修改意见" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("button", { name: "附加到输入框" })).toBeVisible();
    await screen.rerender(<ArtifactWall {...props} revisionEnabled />);
    await expect
      .element(screen.getByRole("textbox", { name: "修改意见" }))
      .toHaveValue("保留构图，只调整边缘");
    expect(props.onRevise).not.toHaveBeenCalled();
  });

  it("keeps the comparison divider keyboard-adjustable when feedback is off", async () => {
    using _locale = testUiLocale("zh-CN");
    const previous = {
      ...ARTIFACTS[0]!,
      id: "a6",
      name: "previous.png",
      path: "/work/previous.png",
    };
    vi.mocked(loadWallArtifacts).mockResolvedValueOnce([...ARTIFACTS, previous]);
    await using screen = await render(
      <ArtifactWall
        environmentId={"environment-local" as EnvironmentId}
        threadId={"thread-1" as ThreadId}
        onAttach={vi.fn()}
      />,
      { router: false },
    );
    await screen.getByRole("button", { name: "查看 cover.png", exact: true }).click();
    await screen
      .getByRole("button", { name: /^查看 previous\.png（/ })
      .click({ modifiers: ["Shift"] });
    const slider = document.querySelector<HTMLInputElement>('[aria-label="拖动中线对比"]')!;
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByRole("slider", { name: "拖动中线对比" })).toHaveValue("51");
    await screen.getByRole("button", { name: "A 全图", exact: true }).click();
    await expect.element(screen.getByRole("slider")).not.toBeInTheDocument();
    await expect
      .element(
        document.querySelector<HTMLImageElement>(
          '[data-artifact-compare] img[alt="previous.png"]',
        )!,
      )
      .toBeVisible();
    await expect
      .element(
        document.querySelector<HTMLImageElement>('[data-artifact-compare] img[alt="cover.png"]')!,
      )
      .not.toBeVisible();
    await screen.getByRole("button", { name: "B 全图", exact: true }).click();
    await expect
      .element(
        document.querySelector<HTMLImageElement>('[data-artifact-compare] img[alt="cover.png"]')!,
      )
      .toBeVisible();
    await expect
      .element(
        document.querySelector<HTMLImageElement>(
          '[data-artifact-compare] img[alt="previous.png"]',
        )!,
      )
      .not.toBeVisible();
    await screen.getByRole("button", { name: "滑动对比", exact: true }).click();
    await expect.element(screen.getByRole("slider", { name: "拖动中线对比" })).toHaveValue("51");
    await screen.getByRole("button", { name: "单图", exact: true }).click();
    await expect.element(screen.getByRole("slider")).not.toBeInTheDocument();
  });

  it("pages images with arrow keys and compares two picked thumbnails", async () => {
    using _locale = testUiLocale("zh-CN");
    const previous = {
      ...ARTIFACTS[0]!,
      id: "a6",
      name: "previous.png",
      path: "/work/previous.png",
    };
    vi.mocked(loadWallArtifacts).mockResolvedValueOnce([...ARTIFACTS, previous]);
    await using screen = await render(
      <ArtifactWall
        environmentId={"environment-local" as EnvironmentId}
        threadId={"thread-1" as ThreadId}
        onAttach={vi.fn()}
      />,
      { router: false },
    );
    await screen.getByRole("button", { name: "查看 cover.png", exact: true }).click();
    await expect.element(screen.getByRole("heading", { name: "cover.png" })).toBeVisible();
    await userEvent.keyboard("{ArrowRight}");
    await expect.element(screen.getByRole("heading", { name: "previous.png" })).toBeVisible();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(screen.getByRole("heading", { name: "cover.png" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await screen.getByRole("button", { name: "选择 cover.png 用于对比" }).click();
    await screen.getByRole("button", { name: "选择 previous.png 用于对比" }).click();
    await screen.getByRole("button", { name: "对比", exact: true }).click();
    await expect.element(screen.getByRole("slider", { name: "拖动中线对比" })).toBeVisible();
  });

  it("keeps feedback when the composer is unavailable and permits retry", async () => {
    using _locale = testUiLocale("zh-CN");
    const onRevise = vi.fn().mockReturnValue(false);
    await using screen = await render(
      <ArtifactWall
        environmentId={"environment-local" as EnvironmentId}
        threadId={"thread-1" as ThreadId}
        onAttach={vi.fn()}
        onRevise={onRevise}
        revisionEnabled
      />,
      { router: false }, // The mocked wall does not navigate.
    );
    await screen.getByRole("button", { name: "查看 cover.png", exact: true }).click();
    await expect.element(screen.getByRole("button", { name: "加入返工草稿" })).toBeDisabled();
    await screen.getByRole("textbox", { name: "修改意见" }).fill("修正右手边缘");
    await screen.getByRole("button", { name: "加入返工草稿" }).click();
    await vi.waitFor(() => {
      expect(
        document.querySelector('[data-slot="dialog-popup"] [role="alert"]')?.textContent,
      ).toContain("修改意见已保留");
    });
    await expect
      .element(screen.getByRole("textbox", { name: "修改意见" }))
      .toHaveValue("修正右手边缘");
    onRevise.mockReturnValue(true);
    await screen.getByRole("button", { name: "加入返工草稿" }).click();
    await expect.element(screen.getByRole("textbox", { name: "修改意见" })).not.toBeInTheDocument();
    expect(onRevise.mock.calls.at(-1)?.[0]).toContain('"path": "/work/cover.png"');
  });
  it("retains an unsent note on closing and reopening the same image", async () => {
    using _locale = testUiLocale("zh-CN");
    await using screen = await render(
      <ArtifactWall
        environmentId={"environment-local" as EnvironmentId}
        threadId={"thread-1" as ThreadId}
        onAttach={vi.fn()}
        onRevise={() => true}
        revisionEnabled
      />,
      { router: false }, // The mocked wall does not navigate.
    );
    await screen.getByRole("button", { name: "查看 cover.png", exact: true }).click();
    await screen.getByRole("textbox", { name: "修改意见" }).fill("保留构图");
    await screen.getByRole("button", { name: "Esc 关闭" }).click();
    await screen.getByRole("button", { name: "查看 cover.png", exact: true }).click();
    await expect.element(screen.getByRole("textbox", { name: "修改意见" })).toHaveValue("保留构图");
  });
});

it("animates only arrivals after the first successful load, not filters or thread changes", async () => {
  using _locale = testUiLocale("zh-CN");
  const environmentId = "environment-local" as EnvironmentId;
  const threadId = "motion-thread" as ThreadId;
  using animate = vi.spyOn(Element.prototype, "animate");
  await using screen = await render(
    <ArtifactWall environmentId={environmentId} threadId={threadId} onAttach={vi.fn()} />,
  );
  await vi.waitFor(() =>
    expect(screen.container.querySelectorAll("li[data-artifact-id]")).toHaveLength(5),
  );
  const rowCalls = () =>
    animate.mock.instances.filter(
      (node): node is Element => node instanceof Element && node.hasAttribute("data-artifact-id"),
    );
  expect(rowCalls()).toHaveLength(0);
  const arrived = { ...ARTIFACTS[3]!, id: "new-file", name: "arrived.md" };
  vi.mocked(loadWallArtifacts).mockResolvedValueOnce([...ARTIFACTS, arrived]);
  await act(() => document.dispatchEvent(new Event("visibilitychange")));
  await vi.waitFor(() =>
    expect(screen.container.querySelector('[data-artifact-id="new-file"]')).not.toBeNull(),
  );
  expect(rowCalls()).toHaveLength(2);
  expect(rowCalls().every((row) => row.getAttribute("data-artifact-id") === "new-file")).toBe(true);
  animate.mockClear();
  await screen.getByRole("button", { name: "文档 2", exact: true }).click();
  expect(rowCalls()).toHaveLength(0);
  await screen.rerender(
    <ArtifactWall
      environmentId={environmentId}
      threadId={"other-motion-thread" as ThreadId}
      onAttach={vi.fn()}
    />,
  );
  await vi.waitFor(() =>
    expect(screen.container.querySelector('[data-artifact-id="a4"]')).not.toBeNull(),
  );
  expect(rowCalls()).toHaveLength(0);
});

it("shows arriving artifacts immediately without animations under reduced motion", async () => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  using _matches = vi.spyOn(media, "matches", "get").mockReturnValue(true);
  using _media = vi.spyOn(window, "matchMedia").mockReturnValue(media);
  await using screen = await render(
    <ArtifactWall
      environmentId={"environment-local" as EnvironmentId}
      threadId={"reduced-motion-thread" as ThreadId}
      onAttach={vi.fn()}
    />,
  );
  await vi.waitFor(() =>
    expect(screen.container.querySelectorAll("li[data-artifact-id]")).toHaveLength(5),
  );
  using animate = vi.spyOn(Element.prototype, "animate");
  vi.mocked(loadWallArtifacts).mockResolvedValueOnce([
    ...ARTIFACTS,
    { ...ARTIFACTS[3]!, id: "reduced-arrival" },
  ]);
  await act(() => document.dispatchEvent(new Event("visibilitychange")));
  await vi.waitFor(() =>
    expect(screen.container.querySelector('[data-artifact-id="reduced-arrival"]')).not.toBeNull(),
  );
  expect(animate).not.toHaveBeenCalled();
});
