import { afterEach, describe, expect, test } from 'bun:test';
import { translateAsrSubtitleMessage, translateSubtitleMessage } from '../../src/background/providers/subtitle-translation';
import type { ProviderStores, ProviderStorageArea } from '../../src/background/providers/storage';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createMemoryStorage(initial: Record<string, unknown> = {}): ProviderStorageArea {
  const data = { ...initial };

  return {
    async get(key: string): Promise<Record<string, unknown>> {
      return { [key]: data[key] };
    },
    async set(items: Record<string, unknown>): Promise<void> {
      Object.assign(data, items);
    },
  };
}

function createStores(): ProviderStores {
  return {
    sync: createMemoryStorage(),
    local: createMemoryStorage({ providerSecrets: { openai: { apiKey: 'test-key' } } }),
  };
}

describe('translateSubtitleMessage', () => {
  test('returns provider-agnostic manual translations by id', async () => {
    globalThis.fetch = async () => Response.json({
      choices: [{ message: { content: '{"translations":[{"id":"a","text":"你好"},{"id":"b","text":"世界"}]}' } }],
    });

    await expect(translateSubtitleMessage({
      type: 'TRANSLATE_SUBTITLE_AI_PROVIDER',
      providerType: 'openai',
      videoId: 'video-1',
      trackId: 'en::manual',
      targetLanguage: 'zh-TW',
      items: [
        { id: 'a', text: 'Hello', startMs: 0, endMs: 1000 },
        { id: 'b', text: 'World', startMs: 1000 },
      ],
    }, createStores())).resolves.toEqual({
      ok: true,
      translations: [
        { id: 'a', text: '你好' },
        { id: 'b', text: '世界' },
      ],
      usage: { inputTokens: undefined, outputTokens: undefined },
    });
  });
});

describe('translateAsrSubtitleMessage', () => {
  test('returns timestamped ASR cues', async () => {
    globalThis.fetch = async () => Response.json({
      choices: [{ message: { content: '{"cues":[{"startMs":0,"endMs":1500,"text":"你好","sourceSegmentIds":["s1"]},{"startMs":1500,"endMs":3500,"text":"世界","sourceSegmentIds":["s2"]}]}' } }],
    });

    await expect(translateAsrSubtitleMessage({
      type: 'TRANSLATE_ASR_SUBTITLE_BATCH',
      providerType: 'openai',
      videoId: 'video-1',
      trackId: 'en::asr',
      targetLanguage: 'zh-TW',
      segments: [
        { id: 's1', startMs: 0, text: 'hello' },
        { id: 's2', startMs: 1500, text: 'world' },
      ],
    }, createStores())).resolves.toEqual({
      ok: true,
      cues: [
        { startMs: 0, endMs: 1500, text: '你好', sourceSegmentIds: ['s1'] },
        { startMs: 1500, endMs: 3500, text: '世界', sourceSegmentIds: ['s2'] },
      ],
      usage: { inputTokens: undefined, outputTokens: undefined },
    });
  });
});
