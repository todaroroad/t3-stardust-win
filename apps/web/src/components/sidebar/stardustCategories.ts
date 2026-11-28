import { useSyncExternalStore } from "react";

export type StardustCategoryPreset = "general" | "developer" | "creator" | "project";
export type EditableStardustPreset = Exclude<StardustCategoryPreset, "project">;

export interface StardustThreadCategory {
  readonly id: string;
  readonly label: string;
  readonly keywords: readonly string[];
}

export interface StardustCategorySettings {
  readonly enabled: boolean;
  readonly preset: StardustCategoryPreset;
  readonly automatic: boolean;
  readonly suggestEnabled: boolean;
  readonly suggestModelKey: string | null;
  readonly hideEmptyCategories: boolean;
  readonly editedCategories: Partial<Record<EditableStardustPreset, readonly StardustThreadCategory[]>>;
}

export const UNSORTED_CATEGORY_ID = "unsorted";

export const STARDUST_CATEGORY_PRESETS: Readonly<
  Record<StardustCategoryPreset, { readonly labelZh: string; readonly labelEn: string }>
> = {
  general: { labelZh: "综合", labelEn: "General" },
  developer: { labelZh: "开发", labelEn: "Developer" },
  creator: { labelZh: "创作", labelEn: "Creator" },
  project: { labelZh: "按所属项目", labelEn: "By project" },
};

function defCat(id: string, label: string, keywordsPipe: string): StardustThreadCategory {
  return {
    id,
    label,
    keywords: keywordsPipe
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export const DEFAULT_PRESET_CATEGORIES: Readonly<
  Record<EditableStardustPreset, readonly StardustThreadCategory[]>
> = {
  general: [
    defCat("development", "开发", "代码|接口|开发|数据库|代码库|构建|逆向|脚本|code|api|bug|refactor|database|test|git|build"),
    defCat("content", "写作与内容", "文章|博客|文案|写作|小说|总结|笔记|书签|article|blog|copywriting|readme"),
    defCat("research", "研究分析", "分析|对比|调研|研究|方案|排查|辨析|analyze|compare|research"),
    defCat("work", "工作事务", "周报|会议|邮件|报销|账单|交易|筛选|report|meeting|email|invoice"),
    defCat("systems", "工具与系统", "磁盘|模型|设置|系统|服务器|部署|美化|额度|同步|disk|model|settings|network|install|gcp|t3"),
  ],
  developer: [
    defCat("fixes", "问题修复", "修复|报错|故障|异常|闪退|bug|fix|error|debug|issue"),
    defCat("features", "功能开发", "功能|接口|新增|重构|组件|美化|feature|api|implement|ui"),
    defCat("review", "代码审查", "评审|审查|核验|测试|review|audit|test"),
    defCat("deploy", "部署与运维", "部署|运维|监控|服务器|打包|构建|deploy|ops|infra|build|ci"),
    defCat("docs", "文档与规范", "文档|说明|规范|索引|记忆|docs|readme|rules"),
  ],
  creator: [
    defCat("scripts", "选题与脚本", "选题|脚本|分镜|大纲|设定|idea|script|storyboard"),
    defCat("writing", "写作与图文", "文章|文案|博客|小说|章节|article|writing|blog|novel"),
    defCat("media", "音视频创作", "视频|动画|音频|音乐|生图|配音|video|audio|music|animation"),
    defCat("publishing", "发布与运营", "发布|运营|推广|频道|publish|campaign|marketing"),
  ],
};

export const UNSORTED_CATEGORY: StardustThreadCategory = {
  id: UNSORTED_CATEGORY_ID,
  label: "待归类",
  keywords: [],
};

const SETTINGS_STORAGE_KEY = "t3m:sidebar-categories-settings:v1";
const OVERRIDES_STORAGE_KEY = "t3code:thread-categories:v1";
const COLLAPSED_STORAGE_KEY = "t3m:collapsed-categories:v1";
const CHANGE_EVENT = "t3m:sidebar-categories-change";
export const OPEN_CATEGORY_DIALOG_EVENT = "t3m:open-category-settings";

const DEFAULT_SETTINGS: StardustCategorySettings = {
  enabled: true,
  preset: "general",
  automatic: true,
  suggestEnabled: true,
  suggestModelKey: null,
  hideEmptyCategories: false,
  editedCategories: {},
};

let cachedSettingsRaw: string | null | undefined;
let cachedSettings: StardustCategorySettings = DEFAULT_SETTINGS;

function parseSettings(raw: string | null): StardustCategorySettings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return DEFAULT_SETTINGS;
    const preset =
      obj.preset === "developer" || obj.preset === "creator" || obj.preset === "project"
        ? obj.preset
        : "general";
    const editedRaw =
      obj.editedCategories && typeof obj.editedCategories === "object"
        ? (obj.editedCategories as Record<string, unknown>)
        : {};
    const editedCategories: Partial<Record<EditableStardustPreset, readonly StardustThreadCategory[]>> = {};
    for (const key of ["general", "developer", "creator"] as const) {
      const arr = editedRaw[key];
      if (Array.isArray(arr)) {
        editedCategories[key] = arr.flatMap((item): StardustThreadCategory[] => {
          if (!item || typeof item !== "object") return [];
          const rec = item as Record<string, unknown>;
          const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : "";
          const label = typeof rec.label === "string" && rec.label.trim() ? rec.label.trim() : "";
          if (!id || !label || id === UNSORTED_CATEGORY_ID) return [];
          const keywords = Array.isArray(rec.keywords)
            ? rec.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
            : [];
          return [{ id, label, keywords }];
        });
      }
    }
    return {
      enabled: typeof obj.enabled === "boolean" ? obj.enabled : true,
      preset,
      automatic: typeof obj.automatic === "boolean" ? obj.automatic : true,
      suggestEnabled: typeof obj.suggestEnabled === "boolean" ? obj.suggestEnabled : true,
      suggestModelKey: typeof obj.suggestModelKey === "string" ? obj.suggestModelKey : null,
      hideEmptyCategories:
        typeof obj.hideEmptyCategories === "boolean" ? obj.hideEmptyCategories : false,
      editedCategories,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function readStardustCategorySettings(): StardustCategorySettings {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (raw !== cachedSettingsRaw) {
    cachedSettingsRaw = raw;
    cachedSettings = parseSettings(raw);
  }
  return cachedSettings;
}

function notifyStoreChange() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function subscribeStore(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function updateStardustCategorySettings(
  patch: Partial<StardustCategorySettings>,
): StardustCategorySettings {
  const next: StardustCategorySettings = {
    ...readStardustCategorySettings(),
    ...patch,
  };
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  cachedSettingsRaw = undefined;
  notifyStoreChange();
  return next;
}

export function useStardustCategorySettings(): StardustCategorySettings {
  return useSyncExternalStore(subscribeStore, readStardustCategorySettings, () => DEFAULT_SETTINGS);
}

// -------------------- Per-thread manual overrides --------------------
export type CategoryOverrides = Readonly<Record<string, string>>;
const EMPTY_OVERRIDES: CategoryOverrides = {};
let cachedOverridesRaw: string | null | undefined;
let cachedOverrides: CategoryOverrides = EMPTY_OVERRIDES;

export function readCategoryOverrides(): CategoryOverrides {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(OVERRIDES_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (raw !== cachedOverridesRaw) {
    cachedOverridesRaw = raw;
    if (!raw) {
      cachedOverrides = EMPTY_OVERRIDES;
    } else {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        cachedOverrides =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? Object.fromEntries(
                Object.entries(parsed).filter(
                  (entry): entry is [string, string] =>
                    typeof entry[1] === "string" && entry[1].length > 0,
                ),
              )
            : EMPTY_OVERRIDES;
      } catch {
        cachedOverrides = EMPTY_OVERRIDES;
      }
    }
  }
  return cachedOverrides;
}

export function setThreadCategoryOverrides(
  changes: Readonly<Record<string, string | null>>,
): boolean {
  const next: Record<string, string> = { ...readCategoryOverrides() };
  for (const [key, categoryId] of Object.entries(changes)) {
    if (categoryId === null) delete next[key];
    else next[key] = categoryId;
  }
  try {
    window.localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  cachedOverridesRaw = undefined;
  notifyStoreChange();
  return true;
}

export function useThreadCategoryOverrides(): CategoryOverrides {
  return useSyncExternalStore(subscribeStore, readCategoryOverrides, () => EMPTY_OVERRIDES);
}

// -------------------- Collapsed category state --------------------
const EMPTY_COLLAPSED: ReadonlySet<string> = new Set();
let cachedCollapsedRaw: string | null | undefined;
let cachedCollapsed: ReadonlySet<string> = EMPTY_COLLAPSED;

export function readCollapsedCategories(): ReadonlySet<string> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (raw !== cachedCollapsedRaw) {
    cachedCollapsedRaw = raw;
    if (!raw) {
      cachedCollapsed = EMPTY_COLLAPSED;
    } else {
      try {
        const parsed = JSON.parse(raw);
        cachedCollapsed = Array.isArray(parsed)
          ? new Set(parsed.filter((v): v is string => typeof v === "string"))
          : EMPTY_COLLAPSED;
      } catch {
        cachedCollapsed = EMPTY_COLLAPSED;
      }
    }
  }
  return cachedCollapsed;
}

export function setCollapsedCategories(ids: Iterable<string>) {
  const arr = [...new Set(ids)];
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
  cachedCollapsedRaw = undefined;
  notifyStoreChange();
}

export function toggleCategoryCollapsed(categoryKey: string) {
  const next = new Set(readCollapsedCategories());
  if (next.has(categoryKey)) next.delete(categoryKey);
  else next.add(categoryKey);
  setCollapsedCategories(next);
}

export function useCollapsedCategories(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeStore, readCollapsedCategories, () => EMPTY_COLLAPSED);
}

// -------------------- Classification logic --------------------
export function getEditableCategories(
  settings: StardustCategorySettings,
  preset?: EditableStardustPreset,
): readonly StardustThreadCategory[] {
  const target = preset ?? (settings.preset === "project" ? "general" : settings.preset);
  return settings.editedCategories[target] ?? DEFAULT_PRESET_CATEGORIES[target];
}

export function getVisibleCategories(
  settings: StardustCategorySettings,
  overrides: CategoryOverrides,
): readonly StardustThreadCategory[] {
  if (settings.preset === "project") return [];
  const base = getEditableCategories(settings, settings.preset);
  const included = new Set(base.map((c) => c.id));
  const assigned = new Set(Object.values(overrides));
  const extras = (["general", "developer", "creator"] as const).flatMap((p) =>
    getEditableCategories(settings, p).filter((entry) => {
      if (!assigned.has(entry.id) || included.has(entry.id)) return false;
      included.add(entry.id);
      return true;
    }),
  );
  return [...base, ...extras, UNSORTED_CATEGORY];
}

function isUntitledPlaceholder(title: string): boolean {
  const value = title.trim();
  return !value || /^(<image|\[external unsupported|Call your built-in)/.test(value);
}

export function classifyStardustThread(
  input: { readonly title: string; readonly projectName?: string | null | undefined },
  settings: StardustCategorySettings,
): string {
  if (!settings.automatic || settings.preset === "project" || isUntitledPlaceholder(input.title)) {
    return UNSORTED_CATEGORY_ID;
  }
  const categories = getEditableCategories(settings, settings.preset);
  const haystack = `${input.title} ${input.projectName ?? ""}`.normalize("NFKC").toLowerCase();
  const titleWords = haystack.split(/[^a-z0-9]+/);
  const matched = categories.find((entry) =>
    entry.keywords.some((kw) => {
      const value = kw.normalize("NFKC").toLowerCase().trim();
      if (!value) return false;
      if (!/^[a-z0-9]+$/.test(value)) return haystack.includes(value);
      return titleWords.includes(value);
    }),
  );
  return matched?.id ?? UNSORTED_CATEGORY_ID;
}

export function resolveStardustThreadCategory(
  overrides: CategoryOverrides,
  threadKey: string,
  input: { readonly title: string; readonly projectName?: string | null | undefined },
  settings: StardustCategorySettings,
  visibleCategories = getVisibleCategories(settings, overrides),
): string {
  const manual = overrides[threadKey];
  if (manual && visibleCategories.some((c) => c.id === manual)) {
    return manual;
  }
  return classifyStardustThread(input, settings);
}

// -------------------- Dialog & Picker Triggers --------------------
let categoryDialogOpen = false;
const dialogListeners = new Set<() => void>();

export function setCategorySettingsDialogOpen(next: boolean) {
  categoryDialogOpen = next;
  dialogListeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener(OPEN_CATEGORY_DIALOG_EVENT, () => {
    setCategorySettingsDialogOpen(true);
  });
}

export function useCategorySettingsDialogOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      dialogListeners.add(listener);
      return () => dialogListeners.delete(listener);
    },
    () => categoryDialogOpen,
    () => false,
  );
}

export interface ThreadCategoryPickerTarget {
  readonly threadKey: string;
  readonly title: string;
  readonly projectName?: string | null | undefined;
}

let pickerTarget: ThreadCategoryPickerTarget | null = null;
const pickerListeners = new Set<() => void>();

export function openStardustThreadCategoryPicker(target: ThreadCategoryPickerTarget | null) {
  pickerTarget = target;
  pickerListeners.forEach((fn) => fn());
}

export function useStardustThreadCategoryPicker(): ThreadCategoryPickerTarget | null {
  return useSyncExternalStore(
    (listener) => {
      pickerListeners.add(listener);
      return () => pickerListeners.delete(listener);
    },
    () => pickerTarget,
    () => null,
  );
}
