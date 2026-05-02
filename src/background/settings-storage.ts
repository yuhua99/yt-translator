import { DEFAULT_SETTINGS, type ExtensionSettings } from '../shared/messages';

export interface SettingsStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export const SETTINGS_KEY = 'settings';

export async function getSettings(storage: SettingsStorageArea): Promise<ExtensionSettings> {
  const stored = await storage.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined) };
}

export async function setSettings(storage: SettingsStorageArea, settings: ExtensionSettings): Promise<void> {
  await storage.set({ [SETTINGS_KEY]: settings });
}
