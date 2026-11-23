/** Read-only shape migration shared by desktop and browser settings loaders. */
export function migrateLegacyClientSettings(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, "language")) return value;
  // Stardust's previous UI defaulted to Chinese without writing appLocale.
  // Only recognize an existing custom settings document; leave fresh/official defaults alone.
  if (!Object.hasOwn(record, "appLocale") && Object.hasOwn(record, "interfaceStyle"))
    return { ...record, language: "zh" };
  if (record.appLocale !== "zh-CN" && record.appLocale !== "en") return value;
  const { appLocale, ...settings } = record;
  return { ...settings, language: appLocale === "zh-CN" ? "zh" : "en" };
}
