import { describe, expect, it } from "vite-plus/test";

import { conversationLabel } from "./conversationLabel";
import { uiText } from "./index";

const zh = ((source, values) => uiText(source, values, "zh-CN")) as typeof uiText;
const en = ((source, values) => uiText(source, values, "en")) as typeof uiText;

describe("conversationLabel in the Chinese UI", () => {
  it("translates the plan row prefix and keeps the step text", () => {
    expect(conversationLabel("Tasks 4/6 · 运行组件测试", zh)).toBe("任务 4/6 · 运行组件测试");
  });

  it("translates group summaries from one to several actions", () => {
    expect(conversationLabel("Read 2 files", zh)).toBe("读取了 2 个文件");
    expect(conversationLabel("Read 1 file", zh)).toBe("读取了 1 个文件");
    expect(conversationLabel("Changed 3 files and ran 1 command", zh)).toBe(
      "修改了 3 个文件、执行了 1 条命令",
    );
    expect(
      conversationLabel("Read 2 files, changed 3 files, and performed 1 other action", zh),
    ).toBe("读取了 2 个文件、修改了 3 个文件、执行了 1 项其他操作");
    expect(conversationLabel("Thought (×3)", zh)).toBe("思考（×3）");
  });

  it("translates live command rows", () => {
    expect(conversationLabel("Running pnpm", zh)).toBe("正在运行 pnpm");
    expect(conversationLabel("Ran pnpm", zh)).toBe("已运行 pnpm");
    expect(conversationLabel("Failed git", zh)).toBe("git 运行失败");
    expect(conversationLabel("Running command", zh)).toBe("正在运行 命令");
  });

  it("leaves unknown sentences, tool titles and user text alone", () => {
    expect(conversationLabel("Read src/WeatherCard.tsx", zh)).toBe("Read src/WeatherCard.tsx");
    expect(conversationLabel("Read 2 files and sing 1 song", zh)).toBe(
      "Read 2 files and sing 1 song",
    );
    expect(conversationLabel("Running the tests now", zh)).toBe("Running the tests now");
  });
});

describe("conversationLabel in the English UI", () => {
  it("never rewrites English labels", () => {
    for (const label of [
      "Tasks 4/6 · Run the component tests",
      "Read 2 files",
      "Changed 3 files and ran 1 command",
      "Read 2 files, changed 3 files, and performed 1 other action",
      "Running pnpm",
      "Failed git",
    ]) {
      expect(conversationLabel(label, en)).toBe(label);
    }
  });
});
