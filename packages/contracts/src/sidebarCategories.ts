import * as Schema from "effect/Schema";
import { ModelSelection } from "./modelSelection.ts";

const Title = Schema.String.check(Schema.isMaxLength(500));
const Category = Schema.String.check(Schema.isMaxLength(120));
export const SidebarCategorySuggestionInput = Schema.Struct({
  titles: Schema.Array(Title).check(Schema.isMinLength(1), Schema.isMaxLength(30)),
  categories: Schema.Array(Category).check(Schema.isMinLength(1), Schema.isMaxLength(40)),
  modelSelection: Schema.NullOr(ModelSelection),
  language: Schema.Literals(["en", "zh"]),
});
export type SidebarCategorySuggestionInput = typeof SidebarCategorySuggestionInput.Type;

export const SidebarCategorySuggestionRow = Schema.Struct({
  titleIndex: Schema.Int,
  categoryIndex: Schema.Int,
  reason: Schema.String.check(Schema.isMaxLength(240)),
});
export const SidebarCategorySuggestionOutput = Schema.Struct({
  model: Schema.String,
  suggestions: Schema.Array(SidebarCategorySuggestionRow),
});
export class SidebarCategorySuggestionError extends Schema.TaggedError<SidebarCategorySuggestionError>()(
  "SidebarCategorySuggestionError",
  { reason: Schema.Literals(["noModel", "noPrice", "generationFailed"]) },
) {}
