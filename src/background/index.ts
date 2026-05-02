import { getSettings, setSettings } from './settings-storage';
import type { ExtensionMessage, ExtensionResponse } from '../shared/messages';

chrome.runtime.onInstalled.addListener(() => {
  console.info('Simple Translator installed');
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === 'GET_SETTINGS') {
        sendResponse({ ok: true, settings: await getSettings(chrome.storage.sync) } satisfies ExtensionResponse);
        return;
      }

      if (message.type === 'SET_SETTINGS') {
        await setSettings(chrome.storage.sync, message.settings);
        sendResponse({ ok: true, settings: message.settings } satisfies ExtensionResponse);
        return;
      }

      sendResponse({ ok: true, message: 'pong' } satisfies ExtensionResponse);
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) } satisfies ExtensionResponse);
    }
  })();

  return true;
});
