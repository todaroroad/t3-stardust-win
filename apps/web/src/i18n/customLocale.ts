// Leaf module: custom copy can be read during module initialization without importing settings or stores.
let locale: "zh-CN" | "en" = "en";
export function readCustomLocale() {
  return locale;
}
export function syncCustomLocale(value: string) {
  locale = isChineseLocale(value) ? "zh-CN" : "en";
}

export function isChineseLocale(locale: string): boolean {
  return /^zh(?:[-_]|$)/i.test(locale.trim());
}

export function resolveStardustLocale(
  preference: string,
  systemLanguage: string,
  supported: readonly string[],
): string {
  if (isChineseLocale(preference)) return "zh";
  if (supported.includes(preference)) return preference;
  return isChineseLocale(systemLanguage) ? "zh" : "en";
}
