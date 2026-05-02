import { DEFAULT_SETTINGS, type ExtensionMessage, type ExtensionResponse, type ExtensionSettings, type ProviderConfigResponse, type SettingsResponse } from '../shared/messages';
import type { ProviderType } from '../background/providers/types';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Popup DOM missing required element: ${selector}`);
  }

  return element;
}

const enabledInput = requiredElement<HTMLInputElement>('#enabled');
const targetLanguageInput = requiredElement<HTMLInputElement>('#target-language');
const providerTypeInput = requiredElement<HTMLSelectElement>('#provider-type');
const providerModelInput = requiredElement<HTMLInputElement>('#provider-model');
const providerApiKeyInput = requiredElement<HTMLInputElement>('#provider-api-key');
const saveButton = requiredElement<HTMLButtonElement>('#save');
const status = requiredElement<HTMLParagraphElement>('#status');

function sendMessage<TResponse extends ExtensionResponse>(message: ExtensionMessage): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
}

function renderSettings(settings: ExtensionSettings): void {
  enabledInput.checked = settings.enabled;
  targetLanguageInput.value = settings.targetLanguage;
  providerTypeInput.value = settings.providerType;
}

function renderProviderConfig(response: ProviderConfigResponse): void {
  if (!response.ok) {
    return;
  }

  providerTypeInput.value = response.config.type;
  providerModelInput.value = response.config.model;
}

async function loadSettings(): Promise<void> {
  const response = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });

  if (response.ok) {
    renderSettings(response.settings);
    renderProviderConfig(await sendMessage<ProviderConfigResponse>({ type: 'GET_PROVIDER_CONFIG', providerType: response.settings.providerType }));
    return;
  }

  renderSettings(DEFAULT_SETTINGS);
  status.textContent = response.error;
}

async function saveSettings(): Promise<void> {
  const providerType = providerTypeInput.value as ProviderType;
  const settings: ExtensionSettings = {
    enabled: enabledInput.checked,
    targetLanguage: targetLanguageInput.value.trim() || DEFAULT_SETTINGS.targetLanguage,
    providerType,
  };

  const settingsResponse = await sendMessage({ type: 'SET_SETTINGS', settings });
  if (!settingsResponse.ok) {
    status.textContent = settingsResponse.error;
    return;
  }

  const configResponse = await sendMessage({
    type: 'SET_PROVIDER_CONFIG',
    config: {
      type: providerType,
      model: providerModelInput.value.trim() || providerType,
    },
  });
  if (!configResponse.ok) {
    status.textContent = configResponse.error;
    return;
  }

  const apiKey = providerApiKeyInput.value.trim();
  if (apiKey) {
    const secretResponse = await sendMessage({ type: 'SET_PROVIDER_SECRET', providerType, secret: { apiKey } });
    if (!secretResponse.ok) {
      status.textContent = secretResponse.error;
      return;
    }
  }

  status.textContent = 'Saved';
}

saveButton.addEventListener('click', () => {
  void saveSettings();
});

void loadSettings();
