import { OpenAiProvider } from './openai';
import type { ProviderConfig, ProviderSecret } from './types';

export const OPENCODE_GO_BASE_URL = 'https://opencode.ai/zen/go/v1';

export class OpencodeGoProvider extends OpenAiProvider {
  constructor(config: ProviderConfig, secret: ProviderSecret) {
    super(config, secret, OPENCODE_GO_BASE_URL);
  }
}
