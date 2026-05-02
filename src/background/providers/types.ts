import type { AsrCueItem, ManualTranslationItem } from '../../youtube/translation-validation';
import type { ProviderUsage } from '../../shared/messages';

export type ProviderType = 'mock' | 'openai' | 'anthropic' | 'opencode-go';

export interface ProviderConfig {
  type: ProviderType;
  model: string;
}

export interface ProviderSecret {
  apiKey?: string;
}

export interface ManualTranslateInput {
  items: Array<{
    id: string;
    text: string;
    startMs: number;
    endMs?: number;
  }>;
  targetLanguage: string;
}

export interface ManualTranslateOutput {
  translations: ManualTranslationItem[];
  usage?: ProviderUsage;
}

export interface AsrTranslateInput {
  segments: Array<{
    id: string;
    startMs: number;
    text: string;
  }>;
  targetLanguage: string;
}

export interface AsrTranslateOutput {
  cues: AsrCueItem[];
  usage?: ProviderUsage;
}

export interface ProviderTestOutput {
  ok: true;
  text: string;
  usage?: ProviderUsage;
}

export interface AiProvider {
  translateManual(input: ManualTranslateInput): Promise<ManualTranslateOutput>;
  translateAsr(input: AsrTranslateInput): Promise<AsrTranslateOutput>;
  testConnection(): Promise<ProviderTestOutput>;
}
