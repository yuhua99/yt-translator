import type { ExtensionMessage, SettingsResponse } from '../shared/messages';

function sendMessage(message: ExtensionMessage): Promise<SettingsResponse> {
  return chrome.runtime.sendMessage(message);
}

async function boot(): Promise<void> {
  const response = await sendMessage({ type: 'GET_SETTINGS' });

  if (!response.ok) {
    console.warn('Simple Translator settings load failed:', response.error);
    return;
  }

  if (!response.settings.enabled) {
    return;
  }

  console.info('Simple Translator enabled:', response.settings.targetLanguage);
}

void boot();
