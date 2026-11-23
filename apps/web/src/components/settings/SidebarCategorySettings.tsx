import { randomUUID } from "~/lib/utils";
import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, PlusIcon, XIcon } from "lucide-react";
import {
  scopedThreadKey,
  scopeProjectRef,
  scopeThreadRef,
  scopedProjectKey,
} from "@t3tools/client-runtime/environment";
import type { SidebarCategoryPreset, SidebarCategorySettings } from "@t3tools/contracts/settings";
import { useSidebarCategories } from "~/hooks/useSidebarCategories";
import { updateClientSettings } from "~/hooks/useSettings";
import { useUiText } from "~/i18n/useUiText";
import { useProjects, useThreadShells } from "~/state/entities";
import { setSidebarGrouping } from "~/sidebarProjectFirst";
import {
  categoryDefinitions,
  categoryLabel,
  resolveThreadCategory,
  SIDEBAR_CATEGORY_PRESETS,
  UNSORTED_CATEGORY_ID,
  type ThreadCategory,
} from "~/threadCategories";
import { useSidebarSuggestionModels } from "~/hooks/useSidebarSuggestionModels";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { SettingsSection } from "./settingsLayout";

export function SidebarCategorySettingsSection() {
  const text = useUiText();
  const { settings, overrides, categories } = useSidebarCategories();
  const threads = useThreadShells();
  const projects = useProjects();
  const { models } = useSidebarSuggestionModels();
  const [dragged, setDragged] = useState<string | null>(null);
  const editable = categoryDefinitions(settings).filter(
    (entry) => entry.id !== UNSORTED_CATEGORY_ID,
  );
  const currentCategories = categoryDefinitions(settings);
  const namesByProject = new Map(
    projects.map((project) => [
      scopedProjectKey(scopeProjectRef(project.environmentId, project.id)),
      project.title,
    ]),
  );
  const counts = new Map<string, number>();
  for (const thread of threads) {
    if (thread.archivedAt || thread.deletedAt) continue;
    const id = resolveThreadCategory(
      overrides,
      scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
      {
        title: thread.title,
        projectName: namesByProject.get(
          scopedProjectKey(scopeProjectRef(thread.environmentId, thread.projectId)),
        ),
      },
      settings,
      categories,
    );
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const save = (patch: Partial<SidebarCategorySettings>) =>
    void updateClientSettings({ sidebarCategories: { ...settings, ...patch } });
  const saveRows = (rows: readonly ThreadCategory[]) => {
    if (settings.preset === "project") return;
    save({ editedCategories: { ...settings.editedCategories, [settings.preset]: rows } });
  };
  const editRow = (id: string, patch: Partial<ThreadCategory>) =>
    saveRows(editable.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  const move = (id: string, position: number) => {
    const item = editable.find((entry) => entry.id === id);
    if (!item || position < 0 || position >= editable.length) return;
    const rows = editable.filter((entry) => entry.id !== id);
    rows.splice(position, 0, item);
    saveRows(rows);
  };

  return (
    <SettingsSection id="sidebar-categories" title={text("Sidebar categories")}>
      <div className="divide-y rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <label htmlFor="sidebar-category-preset" className="text-stardust-body font-semibold">
              {text("Preset")}
            </label>
            <p className="text-xs text-muted-foreground">
              {text("Manual choices stay in place when automatic categories change.")}
            </p>
          </div>
          <select
            id="sidebar-category-preset"
            value={settings.preset}
            className="max-w-full rounded-md border bg-background px-2 py-1 text-xs outline-primary"
            onChange={(event) => {
              const preset = event.target.value as SidebarCategoryPreset;
              setSidebarGrouping(preset === "project" ? "project" : "category");
              save({ preset });
            }}
          >
            {Object.entries(SIDEBAR_CATEGORY_PRESETS).map(([id, entry]) => (
              <option key={id} value={id}>
                {text(entry.label)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <label htmlFor="sidebar-category-auto" className="text-stardust-body font-semibold">
              {text("File by title automatically")}
            </label>
            <p className="text-xs text-muted-foreground">
              {text("A title containing a keyword goes into its matching category.")}
            </p>
          </div>
          <Switch
            id="sidebar-category-auto"
            checked={settings.automatic}
            onCheckedChange={(automatic) => save({ automatic })}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <label htmlFor="sidebar-category-suggest" className="text-stardust-body font-semibold">
              {text("Ask a model for suggestions")}
            </label>
            <p className="text-xs text-muted-foreground">
              {text(
                "At five unsorted threads, a prompt offers to send their titles for suggestions.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label={text("Suggestion model")}
              className="max-w-full rounded-md border bg-background px-2 py-1 text-xs outline-primary"
              disabled={!settings.suggestions}
              value={
                settings.suggestionModel
                  ? JSON.stringify([
                      settings.suggestionModel.instanceId,
                      settings.suggestionModel.model,
                    ])
                  : ""
              }
              onChange={(event) =>
                save({
                  suggestionModel:
                    models.find((item) => item.key === event.target.value)?.selection ?? null,
                })
              }
            >
              <option value="">{text("Cheapest ready model")}</option>
              {models.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
              {settings.suggestionModel &&
              !models.some(
                (item) =>
                  item.key ===
                  JSON.stringify([
                    settings.suggestionModel?.instanceId,
                    settings.suggestionModel?.model,
                  ]),
              ) ? (
                <option
                  value={JSON.stringify([
                    settings.suggestionModel.instanceId,
                    settings.suggestionModel.model,
                  ])}
                >
                  {settings.suggestionModel.model} · {text("Unavailable")}
                </option>
              ) : null}
            </select>
            <Switch
              id="sidebar-category-suggest"
              checked={settings.suggestions}
              onCheckedChange={(suggestions) => save({ suggestions })}
            />
          </div>
        </div>
      </div>
      {settings.preset === "project" ? (
        <p className="text-sm text-muted-foreground">{text("Projects are shown by folder.")}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {text("Drag to reorder. Edit a name or add keywords to match titles.")}
            </p>
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                saveRows([
                  ...editable,
                  { id: randomUUID(), label: text("New category"), keywords: [] },
                ])
              }
            >
              <PlusIcon />
              {text("Add category")}
            </Button>
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {currentCategories.map((entry, index) =>
              entry.id === UNSORTED_CATEGORY_ID ? (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 p-4 text-stardust-body"
                >
                  {categoryLabel(entry, text)}
                  <span className="tabular-nums text-muted-foreground">
                    {counts.get(entry.id) ?? 0}
                  </span>
                </div>
              ) : (
                <div
                  key={entry.id}
                  onDragOver={(event) => {
                    if (dragged) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged) move(dragged, index);
                    setDragged(null);
                  }}
                  className="flex flex-wrap items-center gap-2 p-3"
                >
                  <button
                    type="button"
                    draggable
                    aria-label={text("Drag to reorder")}
                    className="cursor-grab text-muted-foreground"
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", entry.id);
                      setDragged(entry.id);
                    }}
                    onDragEnd={() => setDragged(null)}
                  >
                    <GripVerticalIcon className="size-4" />
                  </button>
                  <Input
                    key={categoryLabel(entry, text)}
                    aria-label={text("Category name")}
                    className="w-36"
                    defaultValue={categoryLabel(entry, text)}
                    onBlur={(event) => {
                      const name = event.currentTarget.value.trim();
                      if (name && name !== categoryLabel(entry, text))
                        editRow(entry.id, { label: name });
                      else event.currentTarget.value = categoryLabel(entry, text);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                  <div className="flex min-w-32 flex-1 flex-wrap items-center gap-1">
                    {entry.keywords.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                        aria-label={text("Remove keyword {keyword}", { keyword })}
                        onClick={() =>
                          editRow(entry.id, {
                            keywords: entry.keywords.filter((word) => word !== keyword),
                          })
                        }
                      >
                        {keyword}
                        <XIcon className="size-3" />
                      </button>
                    ))}
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const input = event.currentTarget.elements.namedItem(
                          "keyword",
                        ) as HTMLInputElement;
                        const keyword = input.value.trim();
                        if (keyword && !entry.keywords.includes(keyword))
                          editRow(entry.id, { keywords: [...entry.keywords, keyword] });
                        input.value = "";
                      }}
                    >
                      <Input
                        name="keyword"
                        className="w-28"
                        aria-label={text("Add keyword")}
                        placeholder={text("Add keyword")}
                      />
                    </form>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {counts.get(entry.id) ?? 0}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={text("Move up")}
                    disabled={index === 0}
                    onClick={() => move(entry.id, index - 1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={text("Move down")}
                    disabled={index === editable.length - 1}
                    onClick={() => move(entry.id, index + 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={text("Remove category")}
                    onClick={() => saveRows(editable.filter((item) => item.id !== entry.id))}
                  >
                    <XIcon />
                  </Button>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
