import { forwardRef, createElement } from "react";
import {
  BriefcaseIcon,
  CodeIcon,
  CpuIcon,
  FileTextIcon,
  FolderIcon,
  LaptopIcon,
  LineChartIcon,
  MessageSquareIcon,
  PaletteIcon,
  WorkflowIcon,
  WrenchIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * V10 sidebar (plan A): a project without its own icon gets a line icon chosen from its name,
 * so categories read at a glance instead of as first-letter tiles. Order matters: the first
 * matching rule wins, and unmatched names fall back to a plain folder.
 */
// The V10 mockup's four-point star (same path as the approved preview), drawn as a line icon.
export const StarburstLineIcon = forwardRef<
  SVGSVGElement,
  React.ComponentProps<"svg"> & { strokeWidth?: number }
>(function StarburstLineIcon({ strokeWidth = 1.7, ...props }, ref) {
  return createElement(
    "svg",
    {
      ref,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinejoin: "round",
      ...props,
    },
    createElement("path", {
      d: "M12 3c.7 4.6 3.4 7.3 8 8-4.6.7-7.3 3.4-8 8-.7-4.6-3.4-7.3-8-8 4.6-.7 7.3-3.4 8-8z",
    }),
  );
}) as unknown as LucideIcon;

// oxlint-disable t3code/no-hardcoded-ui-han -- patterns match user-created category names; nothing here is shown as copy
const RULES: ReadonlyArray<readonly [RegExp, LucideIcon]> = [
  [/^\s*x\s*$|twitter|推特/i, XIcon],
  [/公众号|微信|wechat|社群|消息/i, MessageSquareIcon],
  [/自动化|知识库|工作流|automation|knowledge|workflow/i, WorkflowIcon],
  [/模型|账号|model|account|provider/i, CpuIcon],
  [/电脑|设备|device|computer|mac|hardware/i, LaptopIcon],
  [/\bT3\b|功能|维护|feature|maintenance/i, StarburstLineIcon],
  [/工具|tool/i, WrenchIcon],
  [/研究|分析|research|analysis|analytics/i, LineChartIcon],
  [/开发|代码|编程|dev|code/i, CodeIcon],
  [/设计|design|logo|图标/i, PaletteIcon],
  [/事务|工作|work|business/i, BriefcaseIcon],
  [/内容|写作|文档|文章|content|writing|doc/i, FileTextIcon],
];
// oxlint-enable t3code/no-hardcoded-ui-han

export function projectSemanticIcon(name: string): LucideIcon {
  for (const [pattern, icon] of RULES) {
    if (pattern.test(name)) return icon;
  }
  return FolderIcon;
}
