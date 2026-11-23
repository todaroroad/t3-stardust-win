import { testUiLocale } from "../../../test/uiLocale";
import { applyThemePalette } from "../../themePalette";
import { ComposerBannerStack } from "./ComposerBannerStack";
import { Button } from "../ui/button";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import "~/index.css";
import { act, fakeTimers, render } from "../../../test/render";
import { ThreadResumeCard, ResumeCard } from "./ThreadResumeCard";
import { useResumeCardStore } from "../../resumeCardStore";
import { useTaskBoard } from "../../taskBoard";
import type { ResumeRequest } from "../../resumeCard";
import type { TaskProgressSnapshot } from "../../taskProgress";

const request: ResumeRequest = {
  key: "card",
  token: "one",
  ref: scopeThreadRef(EnvironmentId.make("fixture"), ThreadId.make("fixture")),
  title: "公众号发布准备",
  reason: "需要你扫码",
  attention: "登录尚未完成，请用微信扫描页面二维码。",
};
const progress: TaskProgressSnapshot = {
  steps: [
    { id: "1", text: "整理文章素材", status: "completed" },
    { id: "2", text: "等待扫码登录", status: "running" },
    { id: "3", text: "检查草稿排版", status: "pending" },
    { id: "4", text: "交回预览结果", status: "pending" },
  ],
  completed: 1,
  total: 4,
  remaining: 3,
  state: "input",
  stale: false,
};
function setup() {
  useResumeCardStore.setState({ selected: {}, hidden: {} });
  useTaskBoard.setState({ data: null, error: null });
  useResumeCardStore.getState().open(request);
}

it("renders only supported rows and the resume controls", async () => {
  using _locale = testUiLocale("zh-CN");
  setup();
  const action = async () => {};
  await using screen = await render(
    <ResumeCard request={request} progress={progress} onContinue={action} onSnooze={action} />,
  );
  for (const label of ["做到", "卡在", "之后"])
    await expect.element(screen.getByText(label, { exact: true })).toBeVisible();
  // “你要做” would only repeat “卡在” here, so it is omitted.
  await expect.element(screen.getByText("你要做", { exact: true })).not.toBeInTheDocument();
  await expect.element(screen.getByText("第 2/4 步 · 等待扫码登录")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "不做了" })).not.toBeInTheDocument();
  await screen.rerender(
    <ResumeCard
      request={{ ...request, attention: "" }}
      progress={null}
      onContinue={action}
      onSnooze={action}
    />,
  );
  for (const label of ["做到", "卡在", "你要做", "之后"])
    await expect.element(screen.getByText(label, { exact: true })).not.toBeInTheDocument();
});

it("keeps failed submissions retryable and hides only after the existing send accepts", async () => {
  using _locale = testUiLocale("zh-CN");
  setup();
  const send = vi
    .fn<() => Promise<void>>()
    .mockRejectedValueOnce(new Error("连接已断开"))
    .mockResolvedValue(undefined);
  await using screen = await render(
    <ThreadResumeCard
      threadRef={request.ref}
      progress={progress}
      disabled={false}
      onContinue={send}
      onSnooze={undefined}
      onDismiss={undefined}
    />,
  );
  await screen.getByRole("button", { name: "我处理好了，继续" }).click();
  await expect.element(screen.getByRole("alert")).toHaveTextContent("连接已断开");
  expect(useResumeCardStore.getState().hidden.card).toBeUndefined();
  using _timers = fakeTimers();
  await screen.getByRole("button", { name: "我处理好了，继续" }).click();
  await vi.waitFor(() => expect(useResumeCardStore.getState().hidden.card).toBe("one"));
  expect(send).toHaveBeenCalledTimes(2);
  expect(screen.container.querySelector<HTMLElement>("[data-resume-card]")?.inert).toBe(true);
  await act(() => vi.advanceTimersByTime(350));
  expect(screen.container.querySelector("[data-resume-card]")).toBeNull();
});

it("hides locally for later and skips exit motion under reduced motion", async () => {
  using _locale = testUiLocale("zh-CN");
  setup();
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  using _matches = vi.spyOn(media, "matches", "get").mockReturnValue(true);
  using _query = vi.spyOn(window, "matchMedia").mockReturnValue(media);
  await using screen = await render(
    <ThreadResumeCard
      threadRef={request.ref}
      progress={progress}
      disabled={false}
      onContinue={async () => {}}
      onSnooze={undefined}
      onDismiss={undefined}
    />,
  );
  await screen.getByRole("button", { name: "稍后提醒" }).click();
  expect(useResumeCardStore.getState().hidden.card).toBe("one");
  expect(screen.container.querySelector("[data-resume-card]")).toBeNull();
});

it("fits the three workbench themes with the upstream banner layout", async () => {
  setup();
  const action = async () => {};
  await using screen = await render(
    <div data-testid="resume-fixture" className="w-[45rem] max-w-full bg-background p-4">
      <ResumeCard
        request={request}
        progress={progress}
        onContinue={action}
        onSnooze={action}
        onDismiss={action}
      />
      <ComposerBannerStack
        detached
        items={[
          {
            id: "turn-artifacts",
            variant: "info",
            title: "本轮产物 2",
            description: "文章草稿 · 配图",
            icon: null,
            actions: (
              <Button size="xs" variant="ghost">
                查看
              </Button>
            ),
          },
        ]}
      />
    </div>,
  );
  const fixture = screen.getByTestId("resume-fixture").element();
  for (const theme of ["graphite", "darkroom", "porcelain"]) {
    document.documentElement.classList.toggle("dark", theme === "darkroom");
    applyThemePalette(theme, theme === "darkroom" ? "dark" : "light");
    expect(fixture.scrollWidth).toBeLessThanOrEqual(fixture.clientWidth);
    fixture.classList.replace("w-[45rem]", "w-80");
    expect(fixture.scrollWidth).toBeLessThanOrEqual(fixture.clientWidth);
    fixture.classList.replace("w-80", "w-[45rem]");
    const row = screen.container.querySelector("[data-composer-banner-row]")!;
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    if (import.meta.env.VITE_CAPTURE_RESUME_CARD === "1") {
      await page.getByTestId("resume-fixture").screenshot({ path: `c61-card-${theme}.png` });
    }
  }
  document.documentElement.classList.remove("dark");
  applyThemePalette("standard", "light");
});
