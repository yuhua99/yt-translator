import { CAPTION_EVENT, type CaptionsCapturedEventDetail } from '../youtube/caption-capture-event';
import type { ExtensionMessage, SettingsResponse } from '../shared/messages';

function sendMessage(message: ExtensionMessage): Promise<SettingsResponse> {
  return chrome.runtime.sendMessage(message);
}

function injectMainWorldCapture(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('youtube.js');
  script.type = 'module';
  script.onload = () => script.remove();
  (document.documentElement || document.head).append(script);
}

function listenForCaptionCapture(): void {
  window.addEventListener(CAPTION_EVENT, (event) => {
    const detail = (event as CustomEvent<CaptionsCapturedEventDetail>).detail;
    console.info('Simple Translator captured captions:', detail.url, detail.responseText.length);
  });
}

async function boot(): Promise<void> {
  injectMainWorldCapture();
  listenForCaptionCapture();

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
