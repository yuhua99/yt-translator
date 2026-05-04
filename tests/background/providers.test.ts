import { afterEach, describe, expect, test } from 'bun:test';
import { AnthropicProvider } from '../../src/background/providers/anthropic';
import { parseJsonObject } from '../../src/background/providers/json';
import { OpenAiProvider } from '../../src/background/providers/openai';
import { OPENCODE_ZEN_BASE_URL, OpencodeZenProvider } from '../../src/background/providers/opencode-zen';
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
  test('stores config in sync storage and secret separately by provider type', async () => {
    const sync = createMemoryStorage();
    const local = createMemoryStorage();

    await setProviderConfig(sync, { type: 'openai', model: 'gpt-4.1-mini' });
    await setProviderSecret(local, 'openai', { apiKey: 'secret-key' });

    await expect(getProviderConfig(sync, 'openai')).resolves.toEqual({ type: 'openai', model: 'gpt-4.1-mini' });
    await expect(getProviderSecret(local, 'openai')).resolves.toEqual({ apiKey: 'secret-key' });
    expect(JSON.stringify(sync.data)).not.toContain('secret-key');
  });

});

describe('OpenAiProvider', () => {
  test('tests connection with tiny request', async () => {
    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 4, completion_tokens: 1 },
      });
    };

    const provider = new OpenAiProvider({ type: 'openai', model: 'gpt-4.1-mini' }, { apiKey: 'key' });

    await expect(provider.testConnection()).resolves.toEqual({ ok: true, text: 'OK', usage: { inputTokens: 4, outputTokens: 1 } });
    expect(requestBody?.max_tokens).toBe(40);
    expect(requestBody).not.toHaveProperty('response_format');
  });

  test('retries with max_completion_tokens when model rejects max_tokens', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);

      if ('max_tokens' in body) {
        return Response.json({ error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." } }, { status: 400 });
      }

      return Response.json({ choices: [{ message: { content: 'OK' } }] });
    };

    const provider = new OpenAiProvider({ type: 'openai', model: 'gpt-5' }, { apiKey: 'key' });

    await expect(provider.testConnection()).resolves.toEqual({ ok: true, text: 'OK', usage: { inputTokens: undefined, outputTokens: undefined } });
    expect(bodies[0]?.max_tokens).toBe(40);
    expect(bodies[1]?.max_completion_tokens).toBe(40);
  });

  test('sends chat completion request and parses manual translations', async () => {
    let request: Request | undefined;
    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        choices: [{ message: { content: '{"translations":[{"id":"a","text":"你好"}]}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    };

    const provider = new OpenAiProvider({ type: 'openai', model: 'gpt-4.1-mini' }, { apiKey: 'key' });
    const result = await provider.translateManual({ targetLanguage: 'Traditional Chinese', items: [{ id: 'a', text: 'Hello', startMs: 0 }] });

    expect(request?.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(request?.headers.get('authorization')).toBe('Bearer key');
    expect(result).toEqual({ translations: [{ id: 'a', text: '你好' }], usage: { inputTokens: 10, outputTokens: 5 } });
  });
});

describe('OpencodeZenProvider', () => {
  test('uses opencode Zen Go base URL', async () => {
    let request: Request | undefined;
    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return Response.json({ choices: [{ message: { content: '{"translations":[{"id":"a","text":"你好"}]}' } }] });
    };

    const provider = new OpencodeZenProvider({ type: 'opencodeZen', model: 'qwen3.6-plus' }, { apiKey: 'key' });
    await provider.translateManual({ targetLanguage: 'zh-TW', items: [{ id: 'a', text: 'Hello', startMs: 0 }] });

    expect(request?.url).toBe(`${OPENCODE_ZEN_BASE_URL}/chat/completions`);
    expect(await request?.json()).toMatchObject({ thinking: false });
  });
});

describe('AnthropicProvider', () => {
  test('tests connection with tiny request', async () => {
    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        content: [{ type: 'text', text: 'OK' }],
        usage: { input_tokens: 4, output_tokens: 1 },
      });
    };

    const provider = new AnthropicProvider({ type: 'anthropic', model: 'claude-sonnet-4-5' }, { apiKey: 'key' });

    await expect(provider.testConnection()).resolves.toEqual({ ok: true, text: 'OK', usage: { inputTokens: 4, outputTokens: 1 } });
    expect(requestBody?.max_tokens).toBe(40);
  });

  test('sends messages request and parses ASR cues', async () => {
    let request: Request | undefined;
    globalThis.fetch = async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        content: [{ type: 'text', text: '{"cues":[{"startMs":0,"endMs":1000,"text":"你好","sourceSegmentIds":["s1"]}]}' }],
        usage: { input_tokens: 8, output_tokens: 4 },
      });
    };

    const provider = new AnthropicProvider({ type: 'anthropic', model: 'claude-sonnet-4-5' }, { apiKey: 'key' });
    const result = await provider.translateAsr({ targetLanguage: 'Traditional Chinese', segments: [{ id: 's1', text: 'Hello', startMs: 0 }] });

    expect(request?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(request?.headers.get('x-api-key')).toBe('key');
    expect(result).toEqual({
      cues: [{ startMs: 0, endMs: 1000, text: '你好', sourceSegmentIds: ['s1'] }],
      usage: { inputTokens: 8, outputTokens: 4 },
    });
  });
});
