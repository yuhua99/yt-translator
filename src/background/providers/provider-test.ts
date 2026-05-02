import { createProvider } from './factory';
import type { ProviderConfig, ProviderSecret, ProviderTestOutput } from './types';

export async function testProviderConnection(config: ProviderConfig, secret: ProviderSecret): Promise<ProviderTestOutput> {
  return createProvider(config, secret).testConnection();
}
