import type { SidebarCategoryPreset, SidebarCategorySettings } from "@t3tools/contracts/settings";
import { uiText } from "./i18n";
import { useSyncExternalStore } from "react";

/**
 * Sidebar categories: a display-only relation layered over projects. Threads keep their
 * project, workspace and id; a category only decides which sidebar row lists them.
 */
export interface ThreadCategory {
  readonly id: string;
  readonly label: string;
  readonly group?: string;
  readonly keywords: readonly string[];
}
export type ThreadCategoryGroup = string;
export type EditableCategoryPreset = Exclude<SidebarCategoryPreset, "project">;
export const UNSORTED_CATEGORY_ID = "unsorted";
export const SIDEBAR_CATEGORY_PRESETS = {
  general: { label: "General preset", description: "A bit of everything" },
  developer: { label: "Developer", description: "Mostly code" },
  creator: { label: "Creator", description: "Writing, video, and publishing" },
  project: { label: "By project", description: "Organize by folder" },
} as const satisfies Record<SidebarCategoryPreset, { label: string; description: string }>;

function category(id: string, label: string, keywords: string): ThreadCategory {
  return { id, label, keywords: keywords.split("|") };
}
const PRESET_CATEGORIES: Record<SidebarCategoryPreset, readonly ThreadCategory[]> = {
  general: [
    category(
      "development",
      "Development",
      "代码|接口|开发|数据库|代码库|code|api|bug|refactor|database|test",
    ),
    category("content", "Writing & content", "文章|博客|文案|写作|article|blog|copywriting|readme"),
    category("research", "Research", "分析|对比|调研|研究|analyze|compare|research"),
    category("work", "Work admin", "周报|会议|邮件|报销|report|meeting|email|invoice"),
    category("systems", "Tools & system", "磁盘|模型|设置|系统|disk|model|settings|network"),
  ],
  developer: [
    category("fixes", "Bug fixes", "修复|报错|故障|bug|fix|error|debug"),
    category("features", "Features", "功能|接口|新增|feature|api|implement"),
    category("review", "Code review", "评审|审查|review"),
    category("docs", "Docs", "文档|说明|docs|readme"),
    category("deploy", "Deploy & ops", "部署|运维|监控|deploy|ops|infra"),
  ],
  creator: [
    category("scripts", "Ideas & scripts", "选题|脚本|分镜|idea|script|storyboard"),
    category("writing", "Writing", "文章|文案|博客|article|writing|blog"),
    category("media", "Video & audio", "视频|动画|音频|video|audio|animation"),
    category("publishing", "Publishing", "发布|运营|推广|publish|campaign|marketing"),
  ],
  project: [],
};
const UNSORTED: ThreadCategory = { id: UNSORTED_CATEGORY_ID, label: "Unsorted", keywords: [] };

export function categoryDefinitions(settings: SidebarCategorySettings): readonly ThreadCategory[] {
  if (settings.preset === "project") return [];
  return [
    ...(settings.editedCategories[settings.preset] ?? PRESET_CATEGORIES[settings.preset]),
    UNSORTED,
  ];
}

/** Keep labels of individually filed threads when switching presets. */
export function visibleCategoryDefinitions(
  settings: SidebarCategorySettings,
  overrides: Readonly<Record<string, string>>,
): readonly ThreadCategory[] {
  const definitions = categoryDefinitions(settings);
  if (settings.preset === "project") return definitions;
  const included = new Set(definitions.map((entry) => entry.id));
  const assigned = new Set(Object.values(overrides));
  const extra = (["general", "developer", "creator"] as const).flatMap((preset) =>
    categoryDefinitions({ ...settings, preset }).filter((entry) => {
      if (!assigned.has(entry.id) || included.has(entry.id)) return false;
      included.add(entry.id);
      return true;
    }),
  );
  return [...definitions.slice(0, -1), ...extra, UNSORTED];
}
export function categoryLabel(category: ThreadCategory, text = uiText) {
  if (category.id === UNSORTED_CATEGORY_ID) return text("Unsorted");
  const isPresetLabel = Object.values(PRESET_CATEGORIES).some((entries) =>
    entries.some((entry) => entry.id === category.id && entry.label === category.label),
  );
  if (!isPresetLabel) return category.label;
  return text(category.label);
}
export function threadCategoryById(
  id: string,
  categories: readonly ThreadCategory[],
): ThreadCategory {
  return categories.find((category) => category.id === id) ?? UNSORTED;
}

type Rule = NonNullable<SidebarCategorySettings["legacyRules"]>["title"][number];
const compiledPatterns = new WeakMap<Rule, RegExp | null>();
export function matchLocalCategoryRule(rule: Rule, text: string): boolean {
  if (!compiledPatterns.has(rule)) {
    try {
      compiledPatterns.set(rule, new RegExp(rule.source, rule.flags.replace(/[gy]/g, "")));
    } catch {
      compiledPatterns.set(rule, null);
    }
  }
  return compiledPatterns.get(rule)?.test(text) ?? false;
}

function untitled(title: string) {
  const value = title.trim();
  return !value || /^(<image|\[external unsupported|Call your built-in)/.test(value);
}

export function classifyThread(
  input: { readonly title: string; readonly projectName?: string | null | undefined },
  settings: SidebarCategorySettings,
): string {
  if (!settings.automatic || settings.preset === "project" || untitled(input.title)) {
    return UNSORTED_CATEGORY_ID;
  }
  const categories = categoryDefinitions(settings);
  const title = input.title.normalize("NFKC").toLowerCase();
  const legacy = settings.preset === "general" ? settings.legacyRules : undefined;
  const matched =
    legacy?.title.find((rule) => matchLocalCategoryRule(rule, input.title)) ??
    legacy?.project.find((rule) => matchLocalCategoryRule(rule, input.projectName ?? ""));
  if (matched && categories.some((entry) => entry.id === matched.categoryId))
    return matched.categoryId;
  const category = categories.find((entry) =>
    entry.keywords.some((keyword) => {
      const value = keyword.normalize("NFKC").toLowerCase().trim();
      if (!value) return false;
      if (!/^[a-z0-9]+$/.test(value)) return title.includes(value);
      return title.split(/[^a-z0-9]+/).includes(value);
    }),
  );
  return category?.id ?? UNSORTED_CATEGORY_ID;
}

const STORAGE_KEY = "t3code:thread-categories:v1";
type Overrides = Readonly<Record<string, string>>;
const EMPTY: Overrides = {};
let cachedRaw: string | null | undefined;
let cached: Overrides = EMPTY;
const listeners = new Set<() => void>();

export function parseCategoryOverrides(raw: string | null): Overrides {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
      ),
    );
  } catch {
    return EMPTY;
  }
}
function read(): Overrides {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* Storage unavailable: automatic categories still apply. */
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseCategoryOverrides(raw);
  }
  return cached;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
export function useThreadCategoryOverrides(): Overrides {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
/** A manual choice is final: automatic rules never move that thread again. */
export function setThreadCategories(changes: Readonly<Record<string, string | null>>): boolean {
  const next: Record<string, string> = { ...read() };
  for (const [key, categoryId] of Object.entries(changes)) {
    if (categoryId === null) delete next[key];
    else next[key] = categoryId;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}
export function setThreadCategory(threadKey: string, categoryId: string | null): boolean {
  return setThreadCategories({ [threadKey]: categoryId });
}
export function resolveThreadCategory(
  overrides: Overrides,
  threadKey: string,
  input: Parameters<typeof classifyThread>[0],
  settings: SidebarCategorySettings,
  categories = visibleCategoryDefinitions(settings, overrides),
): string {
  const manual = overrides[threadKey];
  return manual && categories.some((category) => category.id === manual)
    ? manual
    : classifyThread(input, settings);
}

export const CATEGORY_PROJECT_KEY_PREFIX = "thread-category:";
export function isCategoryProjectKey(projectKey: string): boolean {
  return projectKey.startsWith(CATEGORY_PROJECT_KEY_PREFIX);
}

/** The category picker is opened from the thread context menu. */
let pickerTarget: { threadKey: string; title: string } | null = null;
const pickerListeners = new Set<() => void>();
export function openThreadCategoryPicker(target: { threadKey: string; title: string } | null) {
  pickerTarget = target;
  pickerListeners.forEach((listener) => listener());
}
export function useThreadCategoryPicker() {
  return useSyncExternalStore(
    (listener) => {
      pickerListeners.add(listener);
      return () => pickerListeners.delete(listener);
    },
    () => pickerTarget,
    () => null,
  );
}

/** A category picked on an empty draft follows it once to the chosen folder's own draft. */
let carriedDraftCategory: { readonly projectKey: string; readonly categoryId: string } | null =
  null;
export function carryDraftCategory(projectKey: string, categoryId: string) {
  carriedDraftCategory = { projectKey, categoryId };
}
export function takeCarriedDraftCategory(projectKey: string): string | null {
  if (carriedDraftCategory?.projectKey !== projectKey) return null;
  const { categoryId } = carriedDraftCategory;
  carriedDraftCategory = null;
  return categoryId;
}
