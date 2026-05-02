import { describe, expect, test } from 'bun:test';
import { createSubtitleCacheKey, type SubtitleCacheKeyInput } from '../../src/youtube/cache-key';

const base: SubtitleCacheKeyInput = {
  providerType: 'openai',
  model: 'gpt-4.1-mini',
  videoId: 'video-1',
  trackId: 'en::manual',
  segmentId: 'video-1:en::manual:0',
  sourceTextHash: 'hash-1',
  targetLanguage: 'zh-TW',
  promptVersion: 'v1',
};

describe('createSubtitleCacheKey', () => {
  test('includes segment id so repeated text does not collide', () => {
    const first = createSubtitleCacheKey(base);
    const second = createSubtitleCacheKey({ ...base, segmentId: 'video-1:en::manual:1' });

    expect(first).not.toBe(second);
  });

  test('includes provider, model, language, and prompt version', () => {
    const keys = new Set([
      createSubtitleCacheKey(base),
      createSubtitleCacheKey({ ...base, providerType: 'anthropic' }),
      createSubtitleCacheKey({ ...base, model: 'claude-sonnet-4' }),
      createSubtitleCacheKey({ ...base, targetLanguage: 'ja' }),
      createSubtitleCacheKey({ ...base, promptVersion: 'v2' }),
    ]);

    expect(keys.size).toBe(5);
  });
});
