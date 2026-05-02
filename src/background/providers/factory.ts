import { AnthropicProvider } from './anthropic';
import { MockProvider } from './mock';
import { OpenAiProvider } from './openai';
import type { AiProvider, ProviderConfig, ProviderSecret } from './types';

export function createProvider(config: ProviderConfig, secret: ProviderSecret): AiProvider {
  if (config.type === 'mock') {
    return new MockProvider();
  }

  if (config.type === 'openai') {
    return new OpenAiProvider(config, secret);
  }

  if (config.type === 'anthropic') {
    return new AnthropicProvider(config, secret);
  }

  throw new Error(`Unsupported provider type: ${String(config.type)}`);
}
