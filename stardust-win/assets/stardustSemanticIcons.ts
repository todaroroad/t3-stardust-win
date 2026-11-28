import type { ProjectIconColor, ProjectIconOverride } from "@t3tools/contracts";
import {
  AppWindowIcon,
  ArchiveIcon,
  AudioLinesIcon,
  BlocksIcon,
  BookmarkIcon,
  BookOpenIcon,
  BotIcon,
  CalendarIcon,
  ChartNoAxesColumnIcon,
  Code2Icon,
  CpuIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FilmIcon,
  FlaskConicalIcon,
  FolderCodeIcon,
  FolderGit2Icon,
  FolderIcon,
  GaugeIcon,
  Globe2,
  InboxIcon,
  KeyRoundIcon,
  Layers3,
  LayersIcon,
  LightbulbIcon,
  type LucideIcon,
  MonitorIcon,
  PackageIcon,
  PaletteIcon,
  PenLineIcon,
  PresentationIcon,
  ServerIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
  SparklesIcon,
  SunIcon,
  TerminalIcon,
  TrendingUpIcon,
  Volume2Icon,
  WorkflowIcon,
  WrenchIcon,
} from "lucide-react";
import { createElement } from "react";

import { cn } from "~/lib/utils";
import { projectIconColorClassName } from "../projectIconColors";

export interface SemanticIconSpec {
  readonly name: string;
  readonly color: ProjectIconColor;
}

const ICON_COMPONENTS: Readonly<Record<string, LucideIcon>> = {
  "app-window": AppWindowIcon,
  archive: ArchiveIcon,
  "audio-lines": AudioLinesIcon,
  blocks: BlocksIcon,
  bookmark: BookmarkIcon,
  "book-open": BookOpenIcon,
  bot: BotIcon,
  calendar: CalendarIcon,
  "chart-no-axes-column": ChartNoAxesColumnIcon,
  "code-2": Code2Icon,
  cpu: CpuIcon,
  database: DatabaseIcon,
  "file-spreadsheet": FileSpreadsheetIcon,
  "file-text": FileTextIcon,
  film: FilmIcon,
  "flask-conical": FlaskConicalIcon,
  folder: FolderIcon,
  "folder-code": FolderCodeIcon,
  "folder-git-2": FolderGit2Icon,
  gauge: GaugeIcon,
  "globe-2": Globe2,
  inbox: InboxIcon,
  "key-round": KeyRoundIcon,
  layers: LayersIcon,
  "layers-3": Layers3,
  lightbulb: LightbulbIcon,
  monitor: MonitorIcon,
  package: PackageIcon,
  palette: PaletteIcon,
  "pen-line": PenLineIcon,
  presentation: PresentationIcon,
  server: ServerIcon,
  "shield-check": ShieldCheckIcon,
  "sliders-horizontal": SlidersHorizontalIcon,
  smartphone: SmartphoneIcon,
  sparkles: SparklesIcon,
  sun: SunIcon,
  terminal: TerminalIcon,
  "trending-up": TrendingUpIcon,
  "volume-2": Volume2Icon,
  workflow: WorkflowIcon,
  wrench: WrenchIcon,
};

interface SemanticRule {
  readonly pattern: RegExp;
  readonly name: string;
  readonly color: ProjectIconColor;
}

const PROJECT_SEMANTIC_RULES: readonly SemanticRule[] = [
  { pattern: /总控|控制台|中枢|control|dashboard|console|admin|hub/i, name: "sliders-horizontal", color: "amber" },
  { pattern: /工作箱|ai[-_\s]?workspace|agent[-_\s]?box|workbench/i, name: "folder-code", color: "emerald" },
  { pattern: /日常|每日|生活|日记|日程|待办|daily|life|journal|routine/i, name: "sun", color: "amber" },
  { pattern: /资源|教程|书签|收藏|课程|导航|指南|手册|resource|tutorial|guide|bookmark|course/i, name: "bookmark", color: "cyan" },
  { pattern: /越狱|红队|渗透|密钥|鉴权|权限|漏洞|jailbreak|redteam|exploit|auth/i, name: "key-round", color: "teal" },
  { pattern: /安全|防护|合规|审计|加密|隐私|security|shield|audit|crypto/i, name: "shield-check", color: "emerald" },
  { pattern: /逆向|反编译|二进制|脱壳|破解|固件|调试|reverse|decompile|binary|ida|ghidra/i, name: "cpu", color: "violet" },
  { pattern: /大模型|本地模型|模型|推理|微调|训练|llm|ollama|vllm|comfy|lora|checkpoint/i, name: "bot", color: "purple" },
  { pattern: /文献|论文|学术|科研|期刊|paper|literature|scholar/i, name: "book-open", color: "rose" },
  { pattern: /学习|总结|汇总|知识库|笔记|读书|阅读|summary|study|note|wiki/i, name: "file-text", color: "indigo" },
  { pattern: /生信|基因|组学|单细胞|转录|测序|蛋白|临床|医学|实验|bio|rna|dna|genom|clinic|med|lab/i, name: "flask-conical", color: "teal" },
  { pattern: /视频|影视|短剧|分镜|动画|剪辑|漫剧|video|movie|film|anime|storyboard|toon/i, name: "film", color: "emerald" },
  { pattern: /音乐|音频|歌曲|配音|播客|声学|编曲|music|audio|song|voice|tts|podcast/i, name: "audio-lines", color: "pink" },
  { pattern: /图片|图像|画图|生图|视觉|摄影|设计|美术|海报|image|photo|design|art|ui|ux/i, name: "palette", color: "pink" },
  { pattern: /软件|网站|网页|前端|站点|博客|门户|浏览器|web|site|frontend|portal|saas|app/i, name: "globe-2", color: "sky" },
  { pattern: /手机|移动端|安卓|小程序|ios|android|mobile|apk/i, name: "smartphone", color: "blue" },
  { pattern: /桌面|客户端|窗口|windows|mac|electron|desktop/i, name: "app-window", color: "blue" },
  { pattern: /服务器|部署|运维|云|容器|节点|集群|代理|server|cloud|infra|devops|docker|vps|clash|proxy/i, name: "server", color: "cyan" },
  { pattern: /数据库|数据|表格|爬虫|采集|统计|报表|data|sql|db|sheet|excel|crawl|analytics/i, name: "database", color: "blue" },
  { pattern: /量化|交易|股票|基金|金融|行情|策略|回测|财务|账单|quant|trade|trading|finance|stock|billing/i, name: "trending-up", color: "amber" },
  { pattern: /写作|内容|小说|文案|公众号|自媒体|剧本|创作|稿件|writing|content|novel|story|blog|post/i, name: "pen-line", color: "orange" },
  { pattern: /工作流|自动化|定时|流水线|编排|workflow|automation|pipeline|cron/i, name: "workflow", color: "violet" },
  { pattern: /归档|备份|历史|旧版|封存|回收|archive|backup|legacy|old|history/i, name: "archive", color: "lime" },
  { pattern: /下载|临时|草稿|未归类|杂项|download|temp|tmp|scratch|inbox|misc/i, name: "inbox", color: "gray" },
  { pattern: /索引|规则|规范|配置|预设|模板|index|rule|config|preset|template/i, name: "layers-3", color: "indigo" },
  { pattern: /工具|插件|脚本|助手|效率|实用|tool|plugin|script|util|helper|cli/i, name: "wrench", color: "cyan" },
  { pattern: /开发|代码|工程|编程|源码|仓库|框架|组件|dev|code|repo|sdk|lib|pkg/i, name: "code-2", color: "sky" },
];

const CATEGORY_SEMANTIC_RULES: readonly SemanticRule[] = [
  { pattern: /开发|工程|代码|编程|架构|前端|后端|调试|dev|code|eng/i, name: "code-2", color: "sky" },
  { pattern: /写作|内容|文案|小说|创作|媒体|叙事|公众号|writing|content/i, name: "pen-line", color: "amber" },
  { pattern: /研究|探索|科研|调研|文献|论文|学术|实验|生信|research|study/i, name: "flask-conical", color: "violet" },
  { pattern: /工具|运维|自动化|脚本|配置|环境|部署|设备|tool|ops|infra/i, name: "wrench", color: "cyan" },
  { pattern: /工作|项目|办公|汇报|协作|业务|管理|需求|work|project|biz/i, name: "presentation", color: "blue" },
  { pattern: /视频|影视|分镜|动画|多媒体|音频|音乐|设计|media|video|design/i, name: "film", color: "pink" },
  { pattern: /数据|量化|交易|金融|统计|账单|分析|data|quant|finance/i, name: "trending-up", color: "emerald" },
  { pattern: /模型|智能体|提示词|训练|推理|ai|llm|agent/i, name: "sparkles", color: "purple" },
  { pattern: /日常|生活|个人|日程|杂谈|daily|life/i, name: "sun", color: "orange" },
  { pattern: /归档|历史|备份|完成|archive/i, name: "archive", color: "lime" },
  { pattern: /未分类|其他|默认|unsorted|other/i, name: "inbox", color: "gray" },
];

const FALLBACK_SPECS: readonly SemanticIconSpec[] = [
  { name: "folder-code", color: "sky" },
  { name: "layers-3", color: "indigo" },
  { name: "sparkles", color: "purple" },
  { name: "blocks", color: "emerald" },
  { name: "lightbulb", color: "amber" },
  { name: "folder-git-2", color: "cyan" },
  { name: "package", color: "orange" },
  { name: "gauge", color: "teal" },
  { name: "terminal", color: "blue" },
  { name: "chart-no-axes-column", color: "rose" },
];

function hashLabel(raw: string): number {
  let h = 2166136261;
  const s = raw.normalize("NFKC").trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function resolveSemanticFolderIcon(folderName: string): SemanticIconSpec {
  const cleaned = folderName.normalize("NFKC").trim();
  if (!cleaned) return { name: "folder", color: "sky" };
  for (const rule of PROJECT_SEMANTIC_RULES) {
    if (rule.pattern.test(cleaned)) {
      return { name: rule.name, color: rule.color };
    }
  }
  return FALLBACK_SPECS[hashLabel(cleaned) % FALLBACK_SPECS.length]!;
}

export function resolveSemanticCategoryIcon(
  categoryLabel: string,
  categoryId?: string,
): SemanticIconSpec {
  if (categoryId === "unsorted" || categoryId === "__unsorted__") {
    return { name: "inbox", color: "gray" };
  }
  const cleaned = categoryLabel.normalize("NFKC").trim();
  if (!cleaned) return { name: "layers", color: "sky" };
  for (const rule of CATEGORY_SEMANTIC_RULES) {
    if (rule.pattern.test(cleaned)) {
      return { name: rule.name, color: rule.color };
    }
  }
  return resolveSemanticFolderIcon(cleaned);
}

export function shouldBeautifyProjectIcon(
  projectIcon: ProjectIconOverride | null | undefined,
  faviconPath?: string | null | undefined,
): boolean {
  if (faviconPath && faviconPath.trim().length > 0) return false;
  if (!projectIcon) return true;
  // Upgrade single-character monograms; keep explicit emoji or user-selected lucide unless requested
  return projectIcon.kind === "monogram";
}

export function StardustSemanticIcon({
  name,
  color,
  className,
}: {
  readonly name: string;
  readonly color?: ProjectIconColor | undefined;
  readonly className?: string | undefined;
}) {
  const Icon = ICON_COMPONENTS[name] ?? FolderCodeIcon;
  const colorCls = color ? projectIconColorClassName(color) : undefined;
  return createElement(
    "span",
    {
      "aria-hidden": "true",
      className: cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center",
        colorCls,
        className,
      ),
    },
    createElement(Icon, { className: cn("size-full", colorCls) }),
  );
}
