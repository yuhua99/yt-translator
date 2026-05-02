import { parseJsonObject } from './json';
import { createAsrPrompt, createManualPrompt } from './prompts';
import type { AiProvider, AsrTranslateInput, AsrTranslateOutput, ManualTranslateInput, ManualTranslateOutput, ProviderConfig, ProviderSecret } from './types';

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export class AnthropicProvider implements AiProvider {
  constructor(
    private readonly config: ProviderConfig,
    private readonly secret: ProviderSecret,
  ) {}

  async translateManual(input: ManualTranslateInput): Promise<ManualTranslateOutput> {
    const response = await this.complete(createManualPrompt(input));
    const parsed = parseJsonObject<ManualTranslateOutput>(response.content);
    return { ...parsed, usage: response.usage };
  }

  async translateAsr(input: AsrTranslateInput): Promise<AsrTranslateOutput> {
    const response = await this.complete(createAsrPrompt(input));
    const parsed = parseJsonObject<AsrTranslateOutput>(response.content);
    return { ...parsed, usage: response.usage };
  }

  private async complete(prompt: string): Promise<{ content: string; usage?: { inputTokens?: number; outputTokens?: number } }> {
    const apiKey = this.secret.apiKey;

    if (!apiKey) {
      throw new Error(`Missing API key for provider: ${this.config.type}`);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 4096,
        temperature: 0,
        system: 'You are a subtitle translation engine. Return valid JSON only.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
    }

    const json = await response.json() as AnthropicResponse;
    const content = json.content?.find((item) => item.type === 'text')?.text;

    if (!content) {
      throw new Error('Anthropic response missing text content');
    }

    return {
      content,
      usage: {
        inputTokens: json.usage?.input_tokens,
        outputTokens: json.usage?.output_tokens,
      },
    };
  }
}
