import { type UiLocale, readUiLocale } from "../src/i18n";
import { syncCustomLocale } from "../src/i18n/customLocale";

export function testUiLocale(locale: UiLocale): Disposable {
  const previous = readUiLocale();
  syncCustomLocale(locale);
  return { [Symbol.dispose]: () => syncCustomLocale(previous) };
}
