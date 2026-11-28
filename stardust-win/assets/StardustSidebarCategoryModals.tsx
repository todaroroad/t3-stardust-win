import {
  isProviderAvailable,
  isProviderTextGenerationCapable,
  type EnvironmentId,
  type ProviderInstanceId,
} from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  GripVerticalIcon,
  LoaderCircleIcon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useEnvironmentModelPreferences } from "~/hooks/useSettings";
import { cn } from "~/lib/utils";
import { useEnvironmentProviders, usePrimaryEnvironmentId } from "~/state/environments";
import { serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import {
  DEFAULT_PRESET_CATEGORIES,
  type EditableStardustPreset,
  getEditableCategories,
  getVisibleCategories,
  openStardustThreadCategoryPicker,
  resolveStardustThreadCategory,
  setCategorySettingsDialogOpen,
  setCollapsedCategories,
  setThreadCategoryOverrides,
  STARDUST_CATEGORY_PRESETS,
  type StardustCategoryPreset,
  type StardustThreadCategory,
  UNSORTED_CATEGORY_ID,
  updateStardustCategorySettings,
  useCategorySettingsDialogOpen,
  useStardustCategorySettings,
  useStardustThreadCategoryPicker,
  useThreadCategoryOverrides,
} from "./stardustCategories";

export interface StarredModelChoice {
  readonly key: string;
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
  readonly model: string;
  readonly label: string;
}

export function useStarredSuggestionModels(): readonly StarredModelChoice[] {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const providersByEnv = useEnvironmentProviders();
  const prefs = useEnvironmentModelPreferences(primaryEnvironmentId);

  return useMemo(() => {
    if (!primaryEnvironmentId) return [];
    const providers = providersByEnv.get(primaryEnvironmentId) ?? [];
    const out: StarredModelChoice[] = [];
    const seen = new Set<string>();

    for (const fav of prefs.favorites) {
      const provider = providers.find((p) => p.instanceId === fav.provider);
      if (
        !provider ||
        !provider.enabled ||
        !provider.installed ||
        provider.status !== "ready" ||
        provider.auth.status === "unauthenticated" ||
        !isProviderAvailable(provider) ||
        !isProviderTextGenerationCapable(provider)
      ) {
        continue;
      }
      const modelObj = provider.models.find(
        (m) => m.slug === fav.model && m.supportsTextGeneration !== false,
      );
      const modelName = modelObj?.name || fav.model;
      const providerLabel = provider.displayName?.trim() || String(provider.driver);
      const key = `${primaryEnvironmentId}::${provider.instanceId}::${fav.model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        environmentId: primaryEnvironmentId,
        instanceId: provider.instanceId,
        model: fav.model,
        label: `${providerLabel} · ${modelName}`,
      });
    }
    return out;
  }, [primaryEnvironmentId, providersByEnv, prefs.favorites]);
}

export interface CategorizableThreadSummary {
  readonly key: string;
  readonly title: string;
  readonly projectName?: string | null | undefined;
}

export const StardustSidebarCategoryModals = memo(function StardustSidebarCategoryModals({
  activeThreads,
}: {
  readonly activeThreads: readonly CategorizableThreadSummary[];
}) {
  const settingsOpen = useCategorySettingsDialogOpen();
  const pickerTarget = useStardustThreadCategoryPicker();
  const settings = useStardustCategorySettings();
  const overrides = useThreadCategoryOverrides();
  const starredModels = useStarredSuggestionModels();
  const suggestCmd = useAtomCommand(
    serverEnvironment.suggestSidebarCategories,
    "sidebar category suggestions",
  );

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [keywordInputs, setKeywordInputs] = useState<Record<string, string>>({});
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestedItems, setSuggestedItems] = useState<
    ReadonlyArray<{
      readonly threadKey: string;
      readonly title: string;
      readonly categoryId: string;
      readonly categoryLabel: string;
      readonly reason: string;
      readonly selected: boolean;
    }>
  >([]);

  const editablePreset: EditableStardustPreset =
    settings.preset === "project" ? "general" : settings.preset;
  const editableCategories = getEditableCategories(settings, editablePreset);
  const visibleCategories = useMemo(
    () => getVisibleCategories(settings, overrides),
    [settings, overrides],
  );

  const { countsByCategory, unsortedThreads } = useMemo(() => {
    const counts = new Map<string, number>();
    const unsorted: CategorizableThreadSummary[] = [];
    for (const thread of activeThreads) {
      const catId = resolveStardustThreadCategory(
        overrides,
        thread.key,
        { title: thread.title, projectName: thread.projectName },
        settings,
        visibleCategories,
      );
      counts.set(catId, (counts.get(catId) ?? 0) + 1);
      if (catId === UNSORTED_CATEGORY_ID) unsorted.push(thread);
    }
    return { countsByCategory: counts, unsortedThreads: unsorted };
  }, [activeThreads, overrides, settings, visibleCategories]);

  const selectedStarredModel =
    starredModels.find((m) => m.key === settings.suggestModelKey) ?? starredModels[0] ?? null;

  const saveCategories = (nextList: readonly StardustThreadCategory[]) => {
    updateStardustCategorySettings({
      editedCategories: {
        ...settings.editedCategories,
        [editablePreset]: nextList,
      },
    });
  };

  const addCategory = () => {
    const nextIdx = editableCategories.length + 1;
    const id = `custom-${Date.now().toString(36)}`;
    saveCategories([
      ...editableCategories,
      { id, label: `新分类 ${nextIdx}`, keywords: [] },
    ]);
  };

  const updateCategoryLabel = (id: string, label: string) => {
    saveCategories(
      editableCategories.map((c) => (c.id === id ? { ...c, label } : c)),
    );
  };

  const removeKeyword = (id: string, kw: string) => {
    saveCategories(
      editableCategories.map((c) =>
        c.id === id ? { ...c, keywords: c.keywords.filter((x) => x !== kw) } : c,
      ),
    );
  };

  const commitKeyword = (id: string) => {
    const raw = (keywordInputs[id] ?? "").trim();
    if (!raw) return;
    const tokens = raw
      .split(/[,，|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    saveCategories(
      editableCategories.map((c) => {
        if (c.id !== id) return c;
        const merged = [...new Set([...c.keywords, ...tokens])];
        return { ...c, keywords: merged };
      }),
    );
    setKeywordInputs((prev) => ({ ...prev, [id]: "" }));
  };

  const moveCategory = (fromIdx: number, toIdx: number) => {
    if (
      fromIdx === toIdx ||
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= editableCategories.length ||
      toIdx >= editableCategories.length
    ) {
      return;
    }
    const copy = [...editableCategories];
    const [picked] = copy.splice(fromIdx, 1);
    if (!picked) return;
    copy.splice(toIdx, 0, picked);
    saveCategories(copy);
  };

  const deleteCategory = (id: string) => {
    saveCategories(editableCategories.filter((c) => c.id !== id));
  };

  const resetCurrentPreset = () => {
    const nextEdited = { ...settings.editedCategories };
    delete nextEdited[editablePreset];
    updateStardustCategorySettings({ editedCategories: nextEdited });
  };

  const runModelSuggestions = async () => {
    if (!selectedStarredModel || unsortedThreads.length === 0 || editableCategories.length === 0) {
      return;
    }
    setSuggestBusy(true);
    setSuggestError(null);
    setSuggestedItems([]);
    try {
      const batch = unsortedThreads.slice(0, 30);
      const res = await suggestCmd({
        environmentId: selectedStarredModel.environmentId,
        input: {
          titles: batch.map((t) =>
            t.projectName ? `${t.title} (${t.projectName})` : t.title,
          ),
          categories: editableCategories.map((c) => c.label),
          modelSelection: {
            instanceId: selectedStarredModel.instanceId,
            model: selectedStarredModel.model,
          },
          language: "zh",
        },
      });
      if (res && AsyncResult.isSuccess(res)) {
        const mapped = res.value.suggestions.flatMap((row) => {
          const targetThread = batch[row.titleIndex];
          const targetCat = editableCategories[row.categoryIndex];
          if (!targetThread || !targetCat) return [];
          return [
            {
              threadKey: targetThread.key,
              title: targetThread.title,
              categoryId: targetCat.id,
              categoryLabel: targetCat.label,
              reason: row.reason,
              selected: true,
            },
          ];
        });
        if (mapped.length === 0) {
          setSuggestError("模型未找到明确匹配的分类建议。");
        } else {
          setSuggestedItems(mapped);
        }
      } else {
        setSuggestError("调用星标模型生成分类建议失败，请确认该模型已登录且就绪。");
      }
    } catch {
      setSuggestError("调用星标模型生成分类建议失败。");
    } finally {
      setSuggestBusy(false);
    }
  };

  const applySuggestedItems = () => {
    const changes: Record<string, string> = {};
    for (const item of suggestedItems) {
      if (item.selected) changes[item.threadKey] = item.categoryId;
    }
    if (Object.keys(changes).length > 0) {
      setThreadCategoryOverrides(changes);
    }
    setSuggestedItems([]);
  };

  const pickerCurrentCategory = pickerTarget
    ? overrides[pickerTarget.threadKey] ?? null
    : null;

  return (
    <>
      {/* 1. Full Custom Category & Keyword Editor Dialog ("侧边栏分类") */}
      <Dialog open={settingsOpen} onOpenChange={setCategorySettingsDialogOpen}>
        <DialogPopup className="max-w-3xl p-0">
          <div className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b border-border/60 px-6 pt-5 pb-4">
              <div className="flex items-center justify-between gap-3 pr-6">
                <div>
                  <DialogTitle className="text-base font-semibold">侧边栏分类</DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                    仅在左侧选中「所有项目」时按分类自动聚合活跃会话，单项目视图保持原样。
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setCollapsedCategories([])}
                  >
                    全部展开
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setCollapsedCategories(visibleCategories.map((c) => c.id))
                    }
                  >
                    全部折叠
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {/* Top Settings Card matching Screenshot 1 */}
              <div className="divide-y divide-border/60 rounded-xl border border-border/75 bg-card/45">
                {/* Row 1: Preset */}
                <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">预设</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      已手动归类的会话会保留原分类。
                    </div>
                  </div>
                  <select
                    aria-label="分类预设"
                    value={settings.enabled ? settings.preset : "__disabled__"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__disabled__") {
                        updateStardustCategorySettings({ enabled: false });
                      } else {
                        updateStardustCategorySettings({
                          enabled: true,
                          preset: val as StardustCategoryPreset,
                        });
                      }
                    }}
                    className="h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-ring"
                  >
                    {(Object.keys(STARDUST_CATEGORY_PRESETS) as StardustCategoryPreset[]).map(
                      (key) => (
                        <option key={key} value={key}>
                          {STARDUST_CATEGORY_PRESETS[key].labelZh}
                        </option>
                      ),
                    )}
                    <option value="__disabled__">关闭分类视图</option>
                  </select>
                </div>

                {/* Row 2: Keyword Auto-Classification */}
                <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">按标题自动归类</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      标题含有关键词时，会话自动进入对应分类。
                    </div>
                  </div>
                  <Switch
                    checked={settings.automatic}
                    onCheckedChange={(checked) =>
                      updateStardustCategorySettings({ automatic: Boolean(checked) })
                    }
                  />
                </div>

                {/* Row 3: Model Suggestion with Starred-Models Dropdown */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">让模型建议分类</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      待归类达到 5 个时提示一次。确认后才发送标题（仅列出已加星标的就绪模型）。
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <select
                      aria-label="选择建议分类的星标模型"
                      disabled={!settings.suggestEnabled || starredModels.length === 0}
                      value={selectedStarredModel?.key ?? ""}
                      onChange={(e) =>
                        updateStardustCategorySettings({
                          suggestModelKey: e.target.value || null,
                        })
                      }
                      className="h-8 max-w-64 truncate rounded-lg border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-ring disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {starredModels.length === 0 ? (
                        <option value="">请先在模型选择器中点星标收藏模型</option>
                      ) : (
                        starredModels.map((m) => (
                          <option key={m.key} value={m.key}>
                            {m.label}
                          </option>
                        ))
                      )}
                    </select>
                    <Switch
                      checked={settings.suggestEnabled}
                      onCheckedChange={(checked) =>
                        updateStardustCategorySettings({ suggestEnabled: Boolean(checked) })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Editable Categories & Keywords Table */}
              {settings.enabled && settings.preset !== "project" ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      拖动排序，点击名称改名，关键词用于匹配标题。
                    </span>
                    <div className="flex items-center gap-2">
                      {settings.editedCategories[editablePreset] ? (
                        <Button size="xs" variant="ghost-muted" onClick={resetCurrentPreset}>
                          <RotateCcwIcon className="size-3.5" />
                          恢复预设默认
                        </Button>
                      ) : null}
                      <Button size="xs" variant="outline" onClick={addCategory}>
                        <PlusIcon className="size-3.5" />
                        添加分类
                      </Button>
                    </div>
                  </div>

                  <div className="divide-y divide-border/60 rounded-xl border border-border/75 bg-card/35">
                    {editableCategories.map((cat, idx) => {
                      const count = countsByCategory.get(cat.id) ?? 0;
                      return (
                        <div
                          key={cat.id}
                          draggable
                          onDragStart={() => setDragIndex(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragIndex !== null && dragIndex !== idx) {
                              moveCategory(dragIndex, idx);
                            }
                            setDragIndex(null);
                          }}
                          onDragEnd={() => setDragIndex(null)}
                          className={cn(
                            "flex flex-wrap items-start gap-3 px-3.5 py-3 transition-colors sm:flex-nowrap",
                            dragIndex === idx && "bg-muted/45 opacity-75",
                          )}
                        >
                          <div className="flex shrink-0 items-center gap-2 pt-1">
                            <span
                              title="拖动排序"
                              className="cursor-grab text-muted-foreground/65 hover:text-foreground active:cursor-grabbing"
                            >
                              <GripVerticalIcon className="size-4" />
                            </span>
                            <Input
                              aria-label="分类名称"
                              value={cat.label}
                              onChange={(e) => updateCategoryLabel(cat.id, e.target.value)}
                              className="h-8 w-32 text-xs font-medium"
                            />
                          </div>

                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pt-0.5">
                            {cat.keywords.map((kw) => (
                              <span
                                key={kw}
                                className="inline-flex h-6 items-center gap-1 rounded-md border border-border/70 bg-muted/65 px-2 text-xs text-foreground/90"
                              >
                                <span>{kw}</span>
                                <button
                                  type="button"
                                  aria-label={`移除关键词 ${kw}`}
                                  onClick={() => removeKeyword(cat.id, kw)}
                                  className="cursor-pointer rounded text-muted-foreground hover:text-foreground"
                                >
                                  <XIcon className="size-3" />
                                </button>
                              </span>
                            ))}
                            <input
                              type="text"
                              placeholder="添加关键词"
                              value={keywordInputs[cat.id] ?? ""}
                              onChange={(e) =>
                                setKeywordInputs((prev) => ({
                                  ...prev,
                                  [cat.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === ",") {
                                  e.preventDefault();
                                  commitKeyword(cat.id);
                                }
                              }}
                              onBlur={() => commitKeyword(cat.id)}
                              className="h-7 w-28 rounded-md border border-border/70 bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:border-ring focus:outline-none"
                            />
                          </div>

                          <div className="ml-auto flex shrink-0 items-center gap-1 pt-1 text-xs text-muted-foreground tabular-nums">
                            <span className="mr-1.5 min-w-4 text-right">{count}</span>
                            <button
                              type="button"
                              aria-label="上移分类"
                              disabled={idx === 0}
                              onClick={() => moveCategory(idx, idx - 1)}
                              className="inline-flex size-6 cursor-pointer items-center justify-center rounded hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <ArrowUpIcon className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="下移分类"
                              disabled={idx === editableCategories.length - 1}
                              onClick={() => moveCategory(idx, idx + 1)}
                              className="inline-flex size-6 cursor-pointer items-center justify-center rounded hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <ArrowDownIcon className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="删除分类"
                              disabled={editableCategories.length <= 1}
                              onClick={() => deleteCategory(cat.id)}
                              className="inline-flex size-6 cursor-pointer items-center justify-center rounded hover:bg-destructive/15 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <XIcon className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Unsorted summary footer row */}
                    <div className="flex items-center justify-between gap-3 bg-muted/20 px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="font-medium text-foreground">待归类</span>
                        {unsortedThreads.length > 0 && selectedStarredModel ? (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={suggestBusy}
                            onClick={() => void runModelSuggestions()}
                          >
                            {suggestBusy ? (
                              <LoaderCircleIcon className="size-3.5 animate-spin" />
                            ) : (
                              <SparklesIcon className="size-3.5" />
                            )}
                            {suggestBusy ? "正在请求星标模型…" : "立即建议分类"}
                          </Button>
                        ) : null}
                      </div>
                      <span className="text-muted-foreground tabular-nums">
                        {countsByCategory.get(UNSORTED_CATEGORY_ID) ?? 0}
                      </span>
                    </div>
                  </div>

                  {suggestError ? (
                    <p className="text-xs text-amber-400">{suggestError}</p>
                  ) : null}

                  {suggestedItems.length > 0 ? (
                    <div className="space-y-2 rounded-xl border border-primary/35 bg-primary/5 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          模型分类建议（确认后应用）
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="xs"
                            variant="ghost-muted"
                            onClick={() => setSuggestedItems([])}
                          >
                            取消
                          </Button>
                          <Button size="xs" onClick={applySuggestedItems}>
                            应用所选建议
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                        {suggestedItems.map((item, idx) => (
                          <label
                            key={item.threadKey}
                            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/50 bg-background/70 px-2.5 py-2 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) =>
                                setSuggestedItems((prev) =>
                                  prev.map((row, i) =>
                                    i === idx ? { ...row, selected: e.target.checked } : row,
                                  ),
                                )
                              }
                              className="mt-0.5 rounded"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium text-foreground">
                                  {item.title}
                                </span>
                                <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                                  → {item.categoryLabel}
                                </span>
                              </div>
                              {item.reason ? (
                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                  {item.reason}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <DialogFooter className="border-t border-border/60 px-6 py-3">
              <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.hideEmptyCategories}
                    onChange={(e) =>
                      updateStardustCategorySettings({
                        hideEmptyCategories: e.target.checked,
                      })
                    }
                    className="rounded"
                  />
                  <span>隐藏无会话的空分类</span>
                </label>
              </div>
              <DialogClose render={<Button size="sm" variant="outline" />}>完成</DialogClose>
            </DialogFooter>
          </div>
        </DialogPopup>
      </Dialog>

      {/* 2. Per-Thread Right-Click Category Picker ("归入分类…") */}
      <Dialog
        open={pickerTarget !== null}
        onOpenChange={(next) => {
          if (!next) openStardustThreadCategoryPicker(null);
        }}
      >
        <DialogPopup className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">归入分类</DialogTitle>
            <DialogDescription className="truncate text-xs">
              {pickerTarget?.title || "选择目标分类"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <button
              type="button"
              onClick={() => {
                if (pickerTarget) {
                  setThreadCategoryOverrides({ [pickerTarget.threadKey]: null });
                }
                openStardustThreadCategoryPicker(null);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-muted",
                pickerCurrentCategory === null && "bg-muted/70 font-semibold text-foreground",
              )}
            >
              <span>自动归类（按标题关键词匹配）</span>
              {pickerCurrentCategory === null ? <CheckIcon className="size-3.5 text-primary" /> : null}
            </button>
            {visibleCategories.map((cat) => {
              const selected = pickerCurrentCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (pickerTarget) {
                      setThreadCategoryOverrides({ [pickerTarget.threadKey]: cat.id });
                    }
                    openStardustThreadCategoryPicker(null);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-muted",
                    selected && "bg-muted/70 font-semibold text-foreground",
                  )}
                >
                  <span>{cat.label}</span>
                  {selected ? <CheckIcon className="size-3.5 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </DialogPopup>
      </Dialog>
    </>
  );
});

void DEFAULT_PRESET_CATEGORIES;
