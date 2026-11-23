import { uiText } from "./index";

const reasonSources: Readonly<Record<string, string>> = {
  待授权: "Needs approval",
  待回答: "Needs an answer",
  运行失败: "Run failed",
  有新结果: "New results",
  待验收: "Ready for review",
  待决定: "Decision pending",
  需要解锁: "Needs unlocking",
};

export function inboxLabel(reason: string): string {
  return uiText(reasonSources[reason] ?? reason);
}
