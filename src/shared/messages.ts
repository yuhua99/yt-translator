import type { ProviderConfig, ProviderSecret } from '../background/providers/types';
import type { AsrCueItem, ManualTranslationItem } from '../youtube/translation-validation';

export interface ExtensionSettings {
  enabled: boolean;
  targetLanguage: string;
  providerId: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: false,
  targetLanguage: 'Traditional Chinese',
  providerId: 'mock',
};

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface TranslateSubtitleMessage {
  type: 'TRANSLATE_SUBTITLE_AI_PROVIDER';
  providerId: string;
  videoId: string;
  trackId: string;
  items: Array<{
    id: string;
    text: string;
    startMs: number;
    endMs?: number;
  }>;
  targetLanguage: string;
}

export interface TranslateSubtitleResult {
  ok: true;
  translations: ManualTranslationItem[];
  usage?: ProviderUsage;
}

export interface TranslateAsrSubtitleMessage {
  type: 'TRANSLATE_ASR_SUBTITLE_BATCH';
  providerId: string;
  videoId: string;
  trackId: string;
  segments: Array<{
    id: string;
    startMs: number;
    text: string;
  }>;
  targetLanguage: string;
}

export interface TranslateAsrSubtitleResult {
  ok: true;
  cues: AsrCueItem[];
  usage?: ProviderUsage;
}

export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; settings: ExtensionSettings }
  | { type: 'PING' }
  | { type: 'GET_PROVIDER_CONFIG'; providerId: string }
  | { type: 'SET_PROVIDER_CONFIG'; config: ProviderConfig }
  | { type: 'SET_PROVIDER_SECRET'; providerId: string; secret: ProviderSecret }
  | TranslateSubtitleMessage
  | TranslateAsrSubtitleMessage;

export type SettingsResponse = { ok: true; settings: ExtensionSettings } | { ok: false; error: string };
export type MessageResponse = { ok: true; message: string } | { ok: false; error: string };
export type ProviderConfigResponse = { ok: true; config: ProviderConfig } | { ok: false; error: string };
export type TranslationResponse = TranslateSubtitleResult | TranslateAsrSubtitleResult | { ok: false; error: string };
export type ExtensionResponse = SettingsResponse | MessageResponse | ProviderConfigResponse | TranslationResponse;
