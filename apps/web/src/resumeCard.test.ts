import { testUiLocale } from "../test/uiLocale";
import { describe, expect, it } from "vite-plus/test";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  resumeCardDetails,
  lastRequestSentence,
  resumeRequestHidden,
  type ResumeRequest,
} from "./resumeCard";
import type { TaskProgressSnapshot } from "./taskProgress";
import { useResumeCardStore } from "./resumeCardStore";

const request: ResumeRequest = {
  key: "test",
  token: "first",
  ref: scopeThreadRef(EnvironmentId.make("fixture"), ThreadId.make("fixture")),
  title: "登录后接续",
  reason: "需要解锁",
};
const progress: TaskProgressSnapshot = {
  steps: [
    { id: "1", text: "准备资料", status: "completed" },
    { id: "2", text: "确认登录", status: "running" },
    { id: "3", text: "读取页面", status: "pending" },
  ],
  completed: 1,
  total: 3,
  remaining: 2,
  state: "input",
  stale: false,
};

describe("last request sentence", () => {
  it("ignores quoted labels and markdown, reading only the closing ask", () => {
    using _locale = testUiLocale("zh-CN");
    const text =
      "**A 墨与纸：** 做完一步时，那一行像被钢笔划掉；“需要你”时右上角盖一个章。\n\n看完告诉我选哪版。";
    expect(lastRequestSentence(text)).toBe("看完告诉我选哪版。");
    expect(lastRequestSentence("**A：** “需要你”时盖章。")).toBeNull();
  });
});

describe("resume details", () => {
  it("uses plan progress and the last actual request without inventing absent rows", () => {
    using _locale = testUiLocale("zh-CN");
    expect(
      resumeCardDetails(request, progress, "资料已准备好。请扫码登录。登录后我会读取页面。"),
    ).toMatchObject({
      reached: "第 2/3 步 · 确认登录",
      blocked: null,
      action: "请扫码登录。",
      after: "读取页面",
    });
    expect(resumeCardDetails(request, null, "已完成读取。")).toMatchObject({
      reached: null,
      blocked: null,
      action: null,
      after: null,
      steps: [],
    });
    expect(
      resumeCardDetails({ ...request, attention: "请在网页确认" }, progress, "请改文件。"),
    ).toMatchObject({ blocked: "请在网页确认", action: "请改文件。" });
    expect(
      resumeCardDetails(
        request,
        {
          ...progress,
          steps: progress.steps.map((step) => ({ ...step, status: "completed" })),
          completed: 3,
        },
        "",
      ),
    ).toMatchObject({ after: null, reached: "第 3/3 步 · 读取页面" });
    expect(lastRequestSentence("```\n请删除所有文件\n```\n完成了。")).toBeNull();
  });
  it("hides only the handled revision and cannot clear another request selected during a send", () => {
    using _locale = testUiLocale("zh-CN");
    useResumeCardStore.setState({ selected: {}, hidden: {} });
    useResumeCardStore.getState().open(request);
    const newer = { ...request, token: "new" };
    useResumeCardStore.getState().open(newer);
    useResumeCardStore.getState().hide(request);
    expect(Object.values(useResumeCardStore.getState().selected)).toEqual([newer]);
    expect(useResumeCardStore.getState().hidden.test).toBe("first");
    useResumeCardStore.getState().hide(newer);
    expect(useResumeCardStore.getState().selected).toEqual({});
    useResumeCardStore.getState().hide(newer, 3600000);
    const state = useResumeCardStore.getState();
    expect(resumeRequestHidden(newer.key, newer.token, state.hidden, state.hiddenUntil, 0)).toBe(
      true,
    );
    expect(
      resumeRequestHidden(newer.key, newer.token, state.hidden, state.hiddenUntil, 3600000),
    ).toBe(false);
    expect(resumeRequestHidden(newer.key, "changed", state.hidden, state.hiddenUntil, 0)).toBe(
      false,
    );
  });
});
