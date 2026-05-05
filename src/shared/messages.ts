import type {
  ProviderConfig,
  ProviderSecret,
  ProviderTestOutput,
  ProviderType,
} from '../background/providers/types'
import type { AsrCueItem, ManualTranslationItem } from '../youtube/translation-validation'

export interface ExtensionSettings {
  enabled: boolean
  targetLanguage: string
  providerType: ProviderType
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: false,
  targetLanguage: 'zh-TW',
  providerType: 'opencodeZen',
}

export interface ProviderUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface TranslateSubtitleMessage {
  type: 'TRANSLATE_SUBTITLE_AI_PROVIDER'
  providerType: ProviderType
  videoId: string
  trackId: string
  items: Array<{
    id: string
    text: string
    startMs: number
    endMs?: number
  }>
  targetLanguage: string
}

export interface TranslateSubtitleResult {
  ok: true
  translations: ManualTranslationItem[]
  usage?: ProviderUsage
}

export interface TranslateAsrSubtitleMessage {
  type: 'TRANSLATE_ASR_SUBTITLE_BATCH'
  providerType: ProviderType
  videoId: string
  trackId: string
  segments: Array<{
    id: string
    startMs: number
    text: string
  }>
  targetLanguage: string
}

export interface TranslateAsrSubtitleResult {
  ok: true
  cues: AsrCueItem[]
  usage?: ProviderUsage
}

export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; settings: ExtensionSettings }
  | { type: 'PING' }
  | { type: 'GET_PROVIDER_CONFIG'; providerType: ProviderType }
  | { type: 'SET_PROVIDER_CONFIG'; config: ProviderConfig }
  | { type: 'SET_PROVIDER_SECRET'; providerType: ProviderType; secret: ProviderSecret }
  | { type: 'TEST_PROVIDER'; config: ProviderConfig; secret: ProviderSecret }
  | { type: 'VALIDATE_ACTIVE_PROVIDER' }
  | TranslateSubtitleMessage
  | TranslateAsrSubtitleMessage

export type SettingsResponse =
  | { ok: true; settings: ExtensionSettings }
  | { ok: false; error: string }
export type MessageResponse = { ok: true; message: string } | { ok: false; error: string }
export type ProviderConfigResponse =
  | { ok: true; config: ProviderConfig }
  | { ok: false; error: string }
export type ProviderTestResponse = ProviderTestOutput | { ok: false; error: string }
export interface TranslationError {
  ok: false
  error: string
  fatal?: boolean
  retried?: boolean
}

export type TranslationResponse =
  | TranslateSubtitleResult
  | TranslateAsrSubtitleResult
  | TranslationError
export type ExtensionResponse =
  | SettingsResponse
  | MessageResponse
  | ProviderConfigResponse
  | ProviderTestResponse
  | TranslationResponse
