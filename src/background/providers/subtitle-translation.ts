import { validateAsrCues, validateManualTranslations } from '../../youtube/translation-validation';
import type { TranslateAsrSubtitleMessage, TranslateAsrSubtitleResult, TranslateSubtitleMessage, TranslateSubtitleResult } from '../../shared/messages';

export async function translateSubtitleMessage(message: TranslateSubtitleMessage): Promise<TranslateSubtitleResult> {
  const translations = await translateManualWithProvider(message);
  const requestedIds = message.items.map((item) => item.id);

  return {
    ok: true,
    translations: validateManualTranslations(requestedIds, translations),
  };
}

export async function translateAsrSubtitleMessage(message: TranslateAsrSubtitleMessage): Promise<TranslateAsrSubtitleResult> {
  const cues = await translateAsrWithProvider(message);
  const knownSegmentIds = message.segments.map((segment) => segment.id);

  return {
    ok: true,
    cues: validateAsrCues(knownSegmentIds, cues),
  };
}

async function translateManualWithProvider(message: TranslateSubtitleMessage): Promise<Array<{ id: string; text: string }>> {
  assertSupportedProvider(message.providerId);

  return message.items.map((item) => ({
    id: item.id,
    text: `[${message.targetLanguage}] ${item.text}`,
  }));
}

async function translateAsrWithProvider(message: TranslateAsrSubtitleMessage): Promise<Array<{ startMs: number; endMs: number; text: string; sourceSegmentIds: string[] }>> {
  assertSupportedProvider(message.providerId);

  return message.segments.map((segment, index) => ({
    startMs: segment.startMs,
    endMs: message.segments[index + 1]?.startMs ?? segment.startMs + 2_000,
    text: `[${message.targetLanguage}] ${segment.text}`,
    sourceSegmentIds: [segment.id],
  }));
}

function assertSupportedProvider(providerId: string): void {
  if (providerId !== 'mock') {
    throw new Error(`Unsupported provider: ${providerId}`);
  }
}
