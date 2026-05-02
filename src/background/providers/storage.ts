import type { ProviderConfig, ProviderSecret, ProviderType } from './types';

export interface ProviderStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface ProviderStores {
  sync: ProviderStorageArea;
  local: ProviderStorageArea;
}

export const PROVIDER_CONFIGS_KEY = 'providerConfigs';
export const PROVIDER_SECRETS_KEY = 'providerSecrets';

const DEFAULT_PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  mock: { type: 'mock', model: 'mock' },
  openai: { type: 'openai', model: 'gpt-4.1-mini' },
  anthropic: { type: 'anthropic', model: 'claude-sonnet-4-5' },
  'opencode-go': { type: 'opencode-go', model: 'go' },
};

export function getDefaultProviderConfig(providerType: ProviderType): ProviderConfig {
  return DEFAULT_PROVIDER_CONFIGS[providerType];
}

export async function getProviderConfig(storage: ProviderStorageArea, providerType: ProviderType): Promise<ProviderConfig> {
  const configs = await getProviderConfigs(storage);
  return configs[providerType] ?? getDefaultProviderConfig(providerType);
}

export async function getProviderSecret(storage: ProviderStorageArea, providerType: ProviderType): Promise<ProviderSecret> {
  const stored = await storage.get(PROVIDER_SECRETS_KEY);
  const secrets = (stored[PROVIDER_SECRETS_KEY] as Partial<Record<ProviderType, ProviderSecret>> | undefined) ?? {};
  return secrets[providerType] ?? {};
}

export async function setProviderConfig(storage: ProviderStorageArea, config: ProviderConfig): Promise<void> {
  const configs = await getProviderConfigs(storage);
  await storage.set({ [PROVIDER_CONFIGS_KEY]: { ...configs, [config.type]: config } });
}

export async function setProviderSecret(storage: ProviderStorageArea, providerType: ProviderType, secret: ProviderSecret): Promise<void> {
  const stored = await storage.get(PROVIDER_SECRETS_KEY);
  const secrets = (stored[PROVIDER_SECRETS_KEY] as Partial<Record<ProviderType, ProviderSecret>> | undefined) ?? {};
  await storage.set({ [PROVIDER_SECRETS_KEY]: { ...secrets, [providerType]: secret } });
}

async function getProviderConfigs(storage: ProviderStorageArea): Promise<Partial<Record<ProviderType, ProviderConfig>>> {
  const stored = await storage.get(PROVIDER_CONFIGS_KEY);
  return (stored[PROVIDER_CONFIGS_KEY] as Partial<Record<ProviderType, ProviderConfig>> | undefined) ?? {};
}
