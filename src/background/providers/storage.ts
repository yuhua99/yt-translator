import type { ProviderConfig, ProviderSecret } from './types';

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

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  id: 'mock',
  type: 'mock',
  model: 'mock',
};

export async function getProviderConfig(storage: ProviderStorageArea, providerId: string): Promise<ProviderConfig> {
  if (providerId === DEFAULT_PROVIDER_CONFIG.id) {
    return DEFAULT_PROVIDER_CONFIG;
  }

  const configs = await getProviderConfigs(storage);
  const config = configs[providerId];

  if (!config) {
    throw new Error(`Provider config not found: ${providerId}`);
  }

  return config;
}

export async function getProviderSecret(storage: ProviderStorageArea, providerId: string): Promise<ProviderSecret> {
  const stored = await storage.get(PROVIDER_SECRETS_KEY);
  const secrets = (stored[PROVIDER_SECRETS_KEY] as Record<string, ProviderSecret> | undefined) ?? {};
  return secrets[providerId] ?? {};
}

export async function setProviderConfig(storage: ProviderStorageArea, config: ProviderConfig): Promise<void> {
  const configs = await getProviderConfigs(storage);
  await storage.set({ [PROVIDER_CONFIGS_KEY]: { ...configs, [config.id]: config } });
}

export async function setProviderSecret(storage: ProviderStorageArea, providerId: string, secret: ProviderSecret): Promise<void> {
  const stored = await storage.get(PROVIDER_SECRETS_KEY);
  const secrets = (stored[PROVIDER_SECRETS_KEY] as Record<string, ProviderSecret> | undefined) ?? {};
  await storage.set({ [PROVIDER_SECRETS_KEY]: { ...secrets, [providerId]: secret } });
}

async function getProviderConfigs(storage: ProviderStorageArea): Promise<Record<string, ProviderConfig>> {
  const stored = await storage.get(PROVIDER_CONFIGS_KEY);
  return (stored[PROVIDER_CONFIGS_KEY] as Record<string, ProviderConfig> | undefined) ?? {};
}
