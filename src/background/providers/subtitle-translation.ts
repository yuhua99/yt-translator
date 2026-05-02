import { createProvider } from './factory';
import { getProviderConfig, getProviderSecret, type ProviderStores } from './storage';
import { validateAsrCues, validateManualTranslations } from '../../youtube/translation-validation';
import type { TranslateAsrSubtitleMessage, TranslateAsrSubtitleResult, TranslateSubtitleMessage, TranslateSubtitleResult } from '../../shared/messages';

export async function translateSubtitleMessage(message: TranslateSubtitleMessage, stores: ProviderStores): Promise<TranslateSubtitleResult> {
  const provider = await resolveProvider(message.providerId, stores);
  const result = await provider.translateManual({
    items: message.items,
    targetLanguage: message.targetLanguage,
  });
  const requestedIds = message.items.map((item) => item.id);

  return {
    ok: true,
    translations: validateManualTranslations(requestedIds, result.translations),
    usage: result.usage,
  };
}

export async function translateAsrSubtitleMessage(message: TranslateAsrSubtitleMessage, stores: ProviderStores): Promise<TranslateAsrSubtitleResult> {
  const provider = await resolveProvider(message.providerId, stores);
  const result = await provider.translateAsr({
    segments: message.segments,
    targetLanguage: message.targetLanguage,
  });
  const knownSegmentIds = message.segments.map((segment) => segment.id);

  return {
    ok: true,
    cues: validateAsrCues(knownSegmentIds, result.cues),
    usage: result.usage,
  };
}

async function resolveProvider(providerId: string, stores: ProviderStores) {
  const config = await getProviderConfig(stores.sync, providerId);
  const secret = await getProviderSecret(stores.local, providerId);
  return createProvider(config, secret);
}
