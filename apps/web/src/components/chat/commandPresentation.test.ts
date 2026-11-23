import { testUiLocale } from "../../../test/uiLocale";
import { expect, it } from "vite-plus/test";
import {
  commandPresentation,
  commandTestResult,
  unwrapCommand,
  visibleActivities,
} from "./commandPresentation";
it.each([
  ["cd '/tmp/a b' && pnpm test", { label: "跑测试", path: "/tmp/a b" }],
  ["set -e; export A='x;y'; umask 022; cd /repo && vp test", { label: "跑测试", path: "/repo" }],
  ["cd /repo && cat src/a.ts", { label: "读取", path: "/repo/src/a.ts" }],
  [
    "cd /repo && python3 - <<'PY'\n# 检查布局\nprint(1)\nPY",
    { label: "运行一段脚本 · 检查布局", path: "/repo" },
  ],
  ["cat cat", { label: "读取", path: "cat" }],
  ["cat /tmp/brief.md 2>/dev/null", { label: "读取", path: "/tmp/brief.md" }],
  ["cat '/tmp/a>b.md' > /tmp/out", { label: "读取", path: "/tmp/a>b.md" }],
  ["cat /tmp/brief.md", { label: "读取", path: "/tmp/brief.md" }],
  ["head -n 20 '/tmp/a b.md'", { label: "读取", path: "/tmp/a b.md" }],
  ["sed -n '1,20p' /tmp/a.ts", { label: "读取", path: "/tmp/a.ts" }],
  ["rg -n -g '*.ts' 'hello world' src", { label: "搜索“hello world”" }],
  ["grep -e error a.log", { label: "搜索“error”" }],
  ["ls -la /tmp/project", { label: "查看", path: "/tmp/project" }],
  ["find src -name '*.ts'", { label: "查看", path: "src" }],
  ["df -h /", { label: "检查磁盘空间" }],
  ["du -sh /tmp", { label: "检查磁盘空间" }],
  ["python3 -c 'import os; print(os.statvfs(\"/\"))'", { label: "检查磁盘空间" }],
  ["vp test run x.test.ts", { label: "跑测试" }],
  ["pnpm test", { label: "跑测试" }],
  ["pnpm build", { label: "构建" }],
  ["tsc --noEmit", { label: "检查代码" }],
  ["vp lint", { label: "检查代码" }],
  [
    `python3 - <<'PY'
# 核对文件
print('a')
PY`,
    { label: "运行一段脚本 · 核对文件" },
  ],
  [
    `python3 - <<'PY'
print('a')
PY`,
    { label: "运行一段脚本" },
  ],
  ["/usr/bin/custom --flag", { label: "运行命令", program: "custom" }],
  ["cat '/tmp/a; b.md' && pnpm test", { label: "读取", path: "/tmp/a; b.md" }],
])("maps %s without evaluating shell input", (command, expected) => {
  using _locale = testUiLocale("zh-CN");
  expect(commandPresentation(command as string)).toEqual(expected);
});
it("unwraps shells, prefers actual descriptions, and keeps missing descriptions truthful", () => {
  using _locale = testUiLocale("zh-CN");
  expect(unwrapCommand('/bin/zsh -lc "cat /tmp/a.md && pnpm test"')).toBe(
    "cat /tmp/a.md && pnpm test",
  );
  expect(commandPresentation('/bin/zsh -lc "cat /tmp/a.md && pnpm test"')).toEqual({
    label: "读取",
    path: "/tmp/a.md",
  });
  expect(commandPresentation("df -h", "核对剩余空间")).toEqual({ label: "核对剩余空间" });
  expect(commandPresentation("df -h", "Bash")).toEqual({ label: "检查磁盘空间" });
  expect(commandPresentation("df -h", "Running run_command")).toEqual({ label: "检查磁盘空间" });
});
it("keeps failures outside the most recent four and folds only beyond five", () => {
  using _locale = testUiLocale("zh-CN");
  const items = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    status: i === 0 ? "failed" : "completed",
  }));
  expect(visibleActivities(items.slice(0, 5))).toEqual({ visible: items.slice(0, 5), hidden: 0 });
  expect(visibleActivities(items)).toEqual({ visible: [items[0], ...items.slice(-4)], hidden: 3 });
});

it("reports only measured test results, with no invented failure count", () => {
  using _locale = testUiLocale("zh-CN");
  expect(commandTestResult("跑测试", "completed")).toBe("跑测试（通过）");
  expect(
    commandTestResult(
      "跑测试",
      "failed",
      "Test Files 1 failed | 3 passed\nTests  4 failed | 42 passed",
    ),
  ).toBe("跑测试（失败 4）");
  expect(commandTestResult("跑测试", "failed")).toBe("跑测试");
  expect(commandTestResult("检查环境", "completed")).toBe("检查环境");
});

it("keeps only the first actual command and ignores executable-only provider titles", () => {
  using _locale = testUiLocale("zh-CN");
  expect(commandPresentation("cd /work && cat package.json && vp test")).toMatchObject({
    label: "读取",
    path: "/work/package.json",
  });
  expect(
    commandPresentation("python3 - <<'PY'\n# 检查结果\nprint(1); print(2)\nPY", "python3").label,
  ).toBe("运行一段脚本 · 检查结果");
});
