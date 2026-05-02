import { parseJsonObject } from './json';
import { createAsrPrompt, createManualPrompt } from './prompts';
import type { AiProvider, AsrTranslateInput, AsrTranslateOutput, ManualTranslateInput, ManualTranslateOutput, ProviderConfig, ProviderSecret } from './types';

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export class OpenAiProvider implements AiProvider {
  constructor(
    private readonly config: ProviderConfig,
    private readonly secret: ProviderSecret,
    private readonly defaultBaseUrl = 'https://api.openai.com/v1',
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
      throw new Error(`Missing API key for provider: ${this.config.id}`);
    }

    const response = await fetch(`${this.config.baseUrl ?? this.defaultBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a subtitle translation engine. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
    }

    const json = await response.json() as OpenAiResponse;
    const content = json.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI response missing message content');
    }

    return {
      content,
      usage: {
        inputTokens: json.usage?.prompt_tokens,
        outputTokens: json.usage?.completion_tokens,
      },
    };
  }
}
