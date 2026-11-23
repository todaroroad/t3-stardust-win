import { DEFAULT_SIDEBAR_CATEGORY_SETTINGS } from "@t3tools/contracts/settings";
import { describe, expect, it } from "vite-plus/test";
import {
  UNSORTED_CATEGORY_ID,
  categoryDefinitions,
  classifyThread,
  parseCategoryOverrides,
  resolveThreadCategory,
} from "./threadCategories";

const settings = DEFAULT_SIDEBAR_CATEGORY_SETTINGS;
describe("classifyThread", () => {
  it("matches both title languages and keeps unmatched titles unsorted", () => {
    expect(classifyThread({ title: "修复数据库接口" }, settings)).toBe("development");
    expect(classifyThread({ title: "Outline a blog article" }, settings)).toBe("content");
    expect(classifyThread({ title: "Rapid response" }, settings)).toBe(UNSORTED_CATEGORY_ID);
    expect(classifyThread({ title: "<image code>" }, settings)).toBe(UNSORTED_CATEGORY_ID);
  });

  it("applies the migrated rule order, IDs, and project fallback", () => {
    const migrated = {
      ...settings,
      editedCategories: {
        general: [
          { id: "local-content", label: "Local content", keywords: [] },
          { id: "local-work", label: "Local work", keywords: [] },
        ],
      },
      legacyRules: {
        title: [
          { categoryId: "local-content", source: "news", flags: "i" },
          { categoryId: "local-work", source: "work", flags: "" },
        ],
        project: [{ categoryId: "local-work", source: "local", flags: "" }],
      },
    };
    expect(classifyThread({ title: "work NEWS", projectName: "local" }, migrated)).toBe(
      "local-content",
    );
    expect(classifyThread({ title: "Hello", projectName: "local" }, migrated)).toBe("local-work");
    expect(
      classifyThread({ title: "work", projectName: "local" }, { ...migrated, automatic: false }),
    ).toBe(UNSORTED_CATEGORY_ID);
  });
});

describe("category overrides", () => {
  it("preserves category IDs without hardcoding a catalog", () => {
    expect(parseCategoryOverrides(null)).toEqual({});
    expect(parseCategoryOverrides("{")).toEqual({});
    expect(parseCategoryOverrides("[]")).toEqual({});
    expect(parseCategoryOverrides('{"a":"old-category","b":"","c":3}')).toEqual({
      a: "old-category",
    });
  });

  it("keeps a manual choice across preset changes", () => {
    const input = { title: "写一篇文章" };
    expect(resolveThreadCategory({}, "k", input, settings)).toBe("content");
    expect(
      resolveThreadCategory({ k: "work" }, "k", input, { ...settings, preset: "creator" }),
    ).toBe("work");
    expect(categoryDefinitions({ ...settings, preset: "project" })).toEqual([]);
  });
});
