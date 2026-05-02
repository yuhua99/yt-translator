export interface ExtensionSettings {
  enabled: boolean;
  targetLanguage: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: false,
  targetLanguage: 'Traditional Chinese',
};

export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; settings: ExtensionSettings }
  | { type: 'PING' };

export type SettingsResponse = { ok: true; settings: ExtensionSettings } | { ok: false; error: string };
export type MessageResponse = { ok: true; message: string } | { ok: false; error: string };
export type ExtensionResponse = SettingsResponse | MessageResponse;
