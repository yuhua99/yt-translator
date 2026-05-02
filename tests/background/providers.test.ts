import { afterEach, describe, expect, test } from 'bun:test';
import { AnthropicProvider } from '../../src/background/providers/anthropic';
import { parseJsonObject } from '../../src/background/providers/json';
import { OpenAiProvider } from '../../src/background/providers/openai';
import { getProviderConfig, getProviderSecret, setProviderConfig, setProviderSecret, type ProviderStorageArea } from '../../src/background/providers/storage';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createMemoryStorage(initial: Record<string, unknown> = {}): ProviderStorageArea & { data: Record<string, unknown> } {
  const data = { ...initial };

  return {
    data,
    async get(key: string): Promise<Record<string, unknown>> {
      return { [key]: data[key] };
    },
    async set(items: Record<string, unknown>): Promise<void> {
      Object.assign(data, items);
    },
  };
}

describe('parseJsonObject', () => {
  test('parses raw, fenced, and embedded JSON', () => {
    expect(parseJsonObject<{ ok: true }>('{"ok":true}')).toEqual({ ok: true });
    expect(parseJsonObject<{ ok: true }>('```json\n{"ok":true}\n```')).toEqual({ ok: true });
    expect(parseJsonObject<{ ok: true }>('text {"ok":true} text')).toEqual({ ok: true });
  });
});

describe('provider storage', () => {
  test('stores config in sync storage and secret separately', async () => {
    const sync = createMemoryStorage();
    const local = createMemoryStorage();

    await setProviderConfig(sync, { id: 'openai-main', type: 'openai', model: 'gpt-4.1-mini' });
    await setProviderSecret(local, 'openai-main', { apiKey: 'secret-key' });

    await expect(getProviderConfig(sync, 'openai-main')).resolves.toEqual({ id: 'openai-main', type: 'openai', model: 'gpt-4.1-mini' });
    await expect(getProviderSecret(local, 'openai-main')).resolves.toEqual({ apiKey: 'secret-key' });
    expect(JSON.stringify(sync.data)).not.toContain('secret-key');
  });
});

describe('OpenAiProvider', () => {
  test('sends chat completion request and parses manual translations', async () => {
    let request: Request | undefined;
    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        choices: [{ message: { content: '{"translations":[{"id":"a","text":"你好"}]}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    };

    const provider = new OpenAiProvider({ id: 'openai-main', type: 'openai', model: 'gpt-4.1-mini' }, { apiKey: 'key' });
    const result = await provider.translateManual({ targetLanguage: 'Traditional Chinese', items: [{ id: 'a', text: 'Hello', startMs: 0 }] });

    expect(request?.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(request?.headers.get('authorization')).toBe('Bearer key');
    expect(result).toEqual({ translations: [{ id: 'a', text: '你好' }], usage: { inputTokens: 10, outputTokens: 5 } });
  });
});

describe('AnthropicProvider', () => {
  test('sends messages request and parses ASR cues', async () => {
    let request: Request | undefined;
    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        content: [{ type: 'text', text: '{"cues":[{"startMs":0,"endMs":1000,"text":"你好","sourceSegmentIds":["s1"]}]}' }],
        usage: { input_tokens: 8, output_tokens: 4 },
      });
    };

    const provider = new AnthropicProvider({ id: 'claude-main', type: 'anthropic', model: 'claude-sonnet-4-5' }, { apiKey: 'key' });
    const result = await provider.translateAsr({ targetLanguage: 'Traditional Chinese', segments: [{ id: 's1', text: 'Hello', startMs: 0 }] });

    expect(request?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(request?.headers.get('x-api-key')).toBe('key');
    expect(result).toEqual({
      cues: [{ startMs: 0, endMs: 1000, text: '你好', sourceSegmentIds: ['s1'] }],
      usage: { inputTokens: 8, outputTokens: 4 },
    });
  });
});
