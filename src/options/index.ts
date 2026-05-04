import { DEFAULT_SETTINGS, type ExtensionMessage, type ExtensionResponse, type ExtensionSettings, type ProviderConfigResponse, type ProviderTestResponse, type SettingsResponse } from '../shared/messages';
import type { ProviderConfig, ProviderSecret, ProviderType } from '../background/providers/types';

const CUSTOM_MODEL_VALUE = '__custom__';

const MODEL_PRESETS: Record<ProviderType, string[]> = {
  openai: ['gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.4', 'gpt-5.5', 'gpt-5.2', 'gpt-5.1', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-5', 'claude-opus-4-5', 'claude-opus-4-1'],
  opencodeZen: ['minimax-m2.7', 'minimax-m2.5', 'kimi-k2.6', 'kimi-k2.5', 'glm-5.1', 'glm-5', 'deepseek-v4-pro', 'deepseek-v4-flash', 'qwen3.6-plus', 'qwen3.5-plus', 'mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2.5-pro', 'mimo-v2.5'],
};

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Options DOM missing required element: ${selector}`);
  return element;
}

const targetLanguageInput = requiredElement<HTMLSelectElement>('#target-language');
const providerTypeInput = requiredElement<HTMLSelectElement>('#provider-type');
const providerModelPresetInput = requiredElement<HTMLSelectElement>('#provider-model-preset');
const customModelRow = requiredElement<HTMLElement>('#custom-model-row');
const providerModelInput = requiredElement<HTMLInputElement>('#provider-model');
const providerApiKeyInput = requiredElement<HTMLInputElement>('#provider-api-key');
const saveButton = requiredElement<HTMLButtonElement>('#save');
const testProviderButton = requiredElement<HTMLButtonElement>('#test-provider');
const status = requiredElement<HTMLParagraphElement>('#status');
let currentSettings: ExtensionSettings = DEFAULT_SETTINGS;

function sendMessage<TResponse extends ExtensionResponse>(message: ExtensionMessage): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
}

function getProviderType(): ProviderType {
  return providerTypeInput.value as ProviderType;
}

function getSelectedModel(): string {
  if (providerModelPresetInput.value === CUSTOM_MODEL_VALUE) {
    return providerModelInput.value.trim();
  }

  return providerModelPresetInput.value;
}

function getProviderConfigFromForm(): ProviderConfig {
  return { type: getProviderType(), model: getSelectedModel() };
}

function getProviderSecretFromForm(): ProviderSecret {
  return { apiKey: providerApiKeyInput.value.trim() || undefined };
}

function renderModelPresets(providerType: ProviderType, selected?: string): void {
  const presets = MODEL_PRESETS[providerType];
  const isCustom = Boolean(selected && !presets.includes(selected));
  const options = presets.map((model) => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    option.selected = model === selected;
    return option;
  });
  const customOption = document.createElement('option');
  customOption.value = CUSTOM_MODEL_VALUE;
  customOption.textContent = 'Custom model';
  customOption.selected = isCustom;

  providerModelPresetInput.replaceChildren(...options, customOption);
  providerModelInput.value = isCustom && selected ? selected : '';
  syncCustomModelVisibility();
}

function syncCustomModelVisibility(): void {
  const isCustom = providerModelPresetInput.value === CUSTOM_MODEL_VALUE;
  customModelRow.hidden = !isCustom;
  providerModelInput.required = isCustom;
}

function renderSettings(settings: ExtensionSettings): void {
  currentSettings = settings;
  targetLanguageInput.value = settings.targetLanguage;
  providerTypeInput.value = settings.providerType;
  renderModelPresets(settings.providerType);
}

function renderProviderConfig(response: ProviderConfigResponse): void {
  if (!response.ok) return;
  providerTypeInput.value = response.config.type;
  renderModelPresets(response.config.type, response.config.model);
}

async function loadSettings(): Promise<void> {
  const response = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
  if (!response.ok) {
    renderSettings(DEFAULT_SETTINGS);
    status.textContent = response.error;
    return;
  }

  renderSettings(response.settings);
  renderProviderConfig(await sendMessage<ProviderConfigResponse>({ type: 'GET_PROVIDER_CONFIG', providerType: response.settings.providerType }));
}

async function saveSettings(): Promise<boolean> {
  const providerType = getProviderType();
  const settings: ExtensionSettings = {
    ...currentSettings,
    targetLanguage: targetLanguageInput.value,
    providerType,
  };

  const settingsResponse = await sendMessage({ type: 'SET_SETTINGS', settings });
  if (!settingsResponse.ok) {
    status.textContent = settingsResponse.error;
    return false;
  }

  const configResponse = await sendMessage({ type: 'SET_PROVIDER_CONFIG', config: getProviderConfigFromForm() });
  if (!configResponse.ok) {
    status.textContent = configResponse.error;
    return false;
  }

  const secret = getProviderSecretFromForm();
  if (secret.apiKey) {
    const secretResponse = await sendMessage({ type: 'SET_PROVIDER_SECRET', providerType, secret });
    if (!secretResponse.ok) {
      status.textContent = secretResponse.error;
      return false;
    }
  }

  status.textContent = 'Saved';
  return true;
}

async function testProvider(): Promise<void> {
  testProviderButton.disabled = true;
  status.textContent = 'Testing active provider...';

  try {
    const saved = await saveSettings();
    if (!saved) return;

    const response = await sendMessage<ProviderTestResponse>({
      type: 'TEST_PROVIDER',
      config: getProviderConfigFromForm(),
      secret: getProviderSecretFromForm(),
    });

    status.textContent = response.ok ? 'Provider test OK' : response.error;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    testProviderButton.disabled = false;
  }
}

providerTypeInput.addEventListener('change', () => {
  renderModelPresets(getProviderType());
});

providerModelPresetInput.addEventListener('change', () => {
  syncCustomModelVisibility();
});

saveButton.addEventListener('click', () => {
  void saveSettings();
});

testProviderButton.addEventListener('click', () => {
  void testProvider();
});

void loadSettings();
