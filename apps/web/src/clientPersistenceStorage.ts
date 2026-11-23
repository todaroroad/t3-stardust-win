import * as Schema from "effect/Schema";
import { migrateLegacyClientSettings } from "@t3tools/shared/clientSettingsMigration";
import { ClientSettingsSchema, type ClientSettings } from "@t3tools/contracts";

import {
  getLocalStorageItem,
  setLocalStorageItem,
  LocalStorageOperationError,
} from "./hooks/useLocalStorage";

const decodeClientSettings = Schema.decodeUnknownSync(ClientSettingsSchema);
const CLIENT_SETTINGS_STORAGE_KEY = "t3code:client-settings:v1";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function readBrowserClientSettings(): ClientSettings | null {
  if (!hasWindow()) {
    return null;
  }

  const stored = getLocalStorageItem(CLIENT_SETTINGS_STORAGE_KEY, Schema.Unknown);
  if (stored === null) return null;
  try {
    return decodeClientSettings(migrateLegacyClientSettings(stored));
  } catch (cause) {
    throw new LocalStorageOperationError({
      operation: "decode",
      storageKey: CLIENT_SETTINGS_STORAGE_KEY,
      cause,
    });
  }
}

export function writeBrowserClientSettings(settings: ClientSettings): void {
  if (!hasWindow()) {
    return;
  }

  setLocalStorageItem(CLIENT_SETTINGS_STORAGE_KEY, settings, ClientSettingsSchema);
}

/** Storage events fire only for other tabs' writes; a null key means storage was cleared. */
export function subscribeBrowserClientSettingsWrites(onChange: () => void): () => void {
  if (!hasWindow()) {
    return () => undefined;
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === CLIENT_SETTINGS_STORAGE_KEY || event.key === null) {
      onChange();
    }
  };
  const target = window;
  target.addEventListener("storage", handleStorage);
  return () => target.removeEventListener("storage", handleStorage);
}
