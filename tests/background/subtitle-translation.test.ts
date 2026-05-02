import { describe, expect, test } from 'bun:test';
import { translateAsrSubtitleMessage, translateSubtitleMessage } from '../../src/background/providers/subtitle-translation';

describe('translateSubtitleMessage', () => {
  test('returns provider-agnostic manual translations by id', async () => {
    await expect(translateSubtitleMessage({
      type: 'TRANSLATE_SUBTITLE_AI_PROVIDER',
      providerId: 'mock',
      videoId: 'video-1',
      trackId: 'en::manual',
      targetLanguage: 'Traditional Chinese',
      items: [
        { id: 'a', text: 'Hello', startMs: 0, endMs: 1000 },
        { id: 'b', text: 'World', startMs: 1000 },
      ],
    })).resolves.toEqual({
      ok: true,
      translations: [
        { id: 'a', text: '[Traditional Chinese] Hello' },
        { id: 'b', text: '[Traditional Chinese] World' },
      ],
    });
  });

  test('rejects unknown provider', async () => {
    await expect(translateSubtitleMessage({
      type: 'TRANSLATE_SUBTITLE_AI_PROVIDER',
      providerId: 'unknown',
      videoId: 'video-1',
      trackId: 'en::manual',
      targetLanguage: 'Traditional Chinese',
      items: [],
    })).rejects.toThrow('Unsupported provider: unknown');
  });
});

describe('translateAsrSubtitleMessage', () => {
  test('returns timestamped ASR cues', async () => {
    await expect(translateAsrSubtitleMessage({
      type: 'TRANSLATE_ASR_SUBTITLE_BATCH',
      providerId: 'mock',
      videoId: 'video-1',
      trackId: 'en::asr',
      targetLanguage: 'Traditional Chinese',
      segments: [
        { id: 's1', startMs: 0, text: 'hello' },
        { id: 's2', startMs: 1500, text: 'world' },
      ],
    })).resolves.toEqual({
      ok: true,
      cues: [
        { startMs: 0, endMs: 1500, text: '[Traditional Chinese] hello', sourceSegmentIds: ['s1'] },
        { startMs: 1500, endMs: 3500, text: '[Traditional Chinese] world', sourceSegmentIds: ['s2'] },
      ],
    });
  });
});
