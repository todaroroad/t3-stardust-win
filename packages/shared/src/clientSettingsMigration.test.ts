import { expect, it } from "vite-plus/test";
import { migrateLegacyClientSettings } from "./clientSettingsMigration.js";
it("maps legacy Chinese and preserves unrelated settings", () => {
  expect(migrateLegacyClientSettings({ appLocale: "zh-CN", fontSizeSidebar: 14 })).toEqual({
    language: "zh",
    fontSizeSidebar: 14,
  });
});
it("keeps an explicitly saved official language", () => {
  const settings = { language: "ja", appLocale: "zh-CN" };
  expect(migrateLegacyClientSettings(settings)).toBe(settings);
});
it("does not mask invalid settings", () => {
  for (const value of [
    null,
    [],
    2,
    { language: null, appLocale: "zh-CN" },
    { appLocale: "invalid" },
  ])
    expect(migrateLegacyClientSettings(value)).toBe(value);
});

it("preserves the implicit Chinese default of an existing Stardust install", () => {
  expect(migrateLegacyClientSettings({ interfaceStyle: "clawd", fontSizeSidebar: 14 })).toEqual({
    interfaceStyle: "clawd",
    fontSizeSidebar: 14,
    language: "zh",
  });
  expect(migrateLegacyClientSettings({})).toEqual({});
});
