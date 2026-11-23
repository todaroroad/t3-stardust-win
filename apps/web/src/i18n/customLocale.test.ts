import { expect, it } from "vite-plus/test";
import { readCustomLocale, resolveStardustLocale, syncCustomLocale } from "./customLocale";

it("uses Chinese for bare, regional, and script-specific Chinese locale IDs", () => {
  try {
    for (const locale of ["zh", "zh-CN", "zh-Hans", "zh-Hant-TW"]) {
      syncCustomLocale(locale);
      expect(readCustomLocale()).toBe("zh-CN");
    }
    syncCustomLocale("en-US");
    expect(readCustomLocale()).toBe("en");
  } finally {
    syncCustomLocale("en");
  }
});

it("chooses the primary system language for a new installation", () => {
  const supported = ["en", "zh", "fr"];
  expect(resolveStardustLocale("system", "zh-CN", supported)).toBe("zh");
  expect(resolveStardustLocale("system", "zh-Hant-TW", supported)).toBe("zh");
  expect(resolveStardustLocale("system", "en-US", supported)).toBe("en");
  expect(resolveStardustLocale("system", "fr-FR", supported)).toBe("en");
  expect(resolveStardustLocale("fr", "zh-CN", supported)).toBe("fr");
  expect(resolveStardustLocale("en", "zh-CN", supported)).toBe("en");
});
