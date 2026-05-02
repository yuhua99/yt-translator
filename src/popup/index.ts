import { DEFAULT_SETTINGS, type ExtensionMessage, type ExtensionResponse, type ExtensionSettings, type SettingsResponse } from '../shared/messages';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Popup DOM missing required element: ${selector}`);
  }

  return element;
}

const enabledInput = requiredElement<HTMLInputElement>('#enabled');
const targetLanguageInput = requiredElement<HTMLInputElement>('#target-language');
const saveButton = requiredElement<HTMLButtonElement>('#save');
const status = requiredElement<HTMLParagraphElement>('#status');

function sendMessage<TResponse extends ExtensionResponse>(message: ExtensionMessage): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
}

function renderSettings(settings: ExtensionSettings): void {
  enabledInput.checked = settings.enabled;
  targetLanguageInput.value = settings.targetLanguage;
}

async function loadSettings(): Promise<void> {
  const response = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });

  if (response.ok) {
    renderSettings(response.settings);
    return;
  }

  renderSettings(DEFAULT_SETTINGS);
  status.textContent = response.error;
}

async function saveSettings(): Promise<void> {
  const settings: ExtensionSettings = {
    enabled: enabledInput.checked,
    targetLanguage: targetLanguageInput.value.trim() || DEFAULT_SETTINGS.targetLanguage,
  };

  const response = await sendMessage({ type: 'SET_SETTINGS', settings });
  status.textContent = response.ok ? 'Saved' : response.error;
}

saveButton.addEventListener('click', () => {
  void saveSettings();
});

void loadSettings();
