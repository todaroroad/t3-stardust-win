import { uiText } from "~/i18n";
import { normalizeSearchText } from "../lib/utils";
import type {
  CommandPaletteActionItem,
  CommandPaletteGroup,
  CommandPaletteSubmenuItem,
} from "./CommandPalette.logic";

export function buildSpotlightGroups(input: {
  activeGroups: readonly CommandPaletteGroup[];
  query: string;
  projectItems: readonly CommandPaletteActionItem[];
  threadItems: readonly CommandPaletteActionItem[];
}): CommandPaletteGroup[] {
  const query = normalizeSearchText(input.query);
  if (!query) {
    const actions = input.activeGroups.filter((g) => g.value === "actions");
    const recent = input.activeGroups.filter((g) => g.value !== "actions");
    const first = actions[0]?.items[0];
    return [
      ...recent,
      ...(first
        ? [
            {
              value: "commands",
              label: "",
              items: [
                {
                  kind: "submenu" as const,
                  value: "commands-menu",
                  title: uiText("Command actions"),
                  description: uiText("Start a task, open settings, or type >"),
                  searchTerms: [],
                  icon: first.icon,
                  addonIcon: first.icon,
                  groups: actions,
                },
              ],
            },
          ]
        : []),
    ];
  }
  const ranked = input.threadItems
    .filter(
      (item) =>
        item.searchScore !== undefined ||
        query
          .split(" ")
          .every((token) => normalizeSearchText(item.searchTerms.join(" ")).includes(token)),
    )
    .toSorted(
      (a, b) =>
        (b.searchScore ?? 0) - (a.searchScore ?? 0) ||
        (b.searchRecency ?? 0) - (a.searchRecency ?? 0),
    );
  const families = new Map<string, CommandPaletteActionItem[]>();
  for (const item of ranked) {
    const key = item.searchFamilyKey ?? item.value;
    const members = families.get(key) ?? [];
    members.push(item);
    families.set(key, members);
  }
  const items: Array<CommandPaletteActionItem | CommandPaletteSubmenuItem> = [];
  for (const [key, members] of families) {
    const best = members[0]!;
    if (members.length === 1 && !best.searchFamilyTitle) {
      items.push(best);
      continue;
    }
    const main = members.filter((item) => !item.searchSubagent);
    const child = members.filter((item) => item.searchSubagent);
    const groups: CommandPaletteGroup[] = [];
    const related = best.searchRelatedItems ?? [];
    const latest = related[0];
    if (main.length)
      groups.push({
        value: `${key}:matches`,
        label: uiText("Related conversations · Best match first"),
        items: main,
      });
    if (latest && related.length > 1)
      groups.push({
        value: `${key}:latest`,
        label: uiText("Continue this work"),
        items: [
          {
            ...latest,
            value: `${latest.value}:latest`,
            title: uiText("Open latest conversation · {count}", {
              count: typeof latest.title === "string" ? latest.title : "",
            }),
          },
        ],
      });
    if (child.length)
      groups.push({ value: `${key}:children`, label: uiText("Matches in subtasks"), items: child });
    const matchedIds = new Set(members.map((m) => m.value));
    const other = related.filter((m: CommandPaletteActionItem) => !matchedIds.has(m.value));
    if (other.length)
      groups.push({
        value: `${key}:history`,
        label: uiText("Other turns · Most recent first"),
        items: other,
      });
    if (members.length === 1 && !best.searchSubagent && related.length <= 1) {
      items.push(best);
      continue;
    }
    items.push({
      kind: "submenu",
      value: `family:${key}`,
      title: best.searchFamilyTitle ?? best.title,
      description: uiText("Related conversations · {count}{match}{subtasks} · Expand to choose", {
        match:
          typeof best.description === "string" &&
          best.description.includes(uiText("Approximate match"))
            ? uiText("Approximate match · ")
            : "",
        count: Math.max(main.length, related.length),
        subtasks: child.length
          ? child.length === 1
            ? uiText(" · {count} subtask", { count: child.length })
            : uiText(" · {count} subtasks", { count: child.length })
          : "",
      }),
      searchTerms: best.searchTerms,
      ...(best.searchScore !== undefined ? { searchScore: best.searchScore } : {}),
      ...(best.threadContentMatch ? { threadContentMatch: best.threadContentMatch } : {}),
      ...(best.timestamp ? { timestamp: best.timestamp } : {}),
      icon: best.icon,
      addonIcon: best.icon,
      groups,
    });
  }
  const groups: CommandPaletteGroup[] = [];
  if (input.projectItems.length)
    groups.push({ value: "projects-top", label: uiText("Projects"), items: input.projectItems });
  if (items.length)
    groups.push({
      value: "spotlight-results",
      label: uiText("Conversations and tasks · Best matches"),
      items,
    });
  return groups;
}
