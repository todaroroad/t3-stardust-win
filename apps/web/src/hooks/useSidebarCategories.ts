import { useClientSettings } from "./useSettings";
import { useUiText } from "../i18n/useUiText";
import {
  categoryLabel,
  useThreadCategoryOverrides,
  visibleCategoryDefinitions,
} from "../threadCategories";

export function useSidebarCategories() {
  const settings = useClientSettings((value) => value.sidebarCategories);
  const overrides = useThreadCategoryOverrides();
  const text = useUiText();
  const categories = visibleCategoryDefinitions(settings, overrides).map((category) => ({
    ...category,
    label: categoryLabel(category, text),
  }));
  return {
    settings,
    overrides,
    categories,
    groups: [...new Set(categories.map((category) => category.group ?? ""))],
  };
}
