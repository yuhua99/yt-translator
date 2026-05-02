import { CAPTION_EVENT, type CaptionsCapturedEventDetail } from '../youtube/caption-capture-event';
import { YoutubeSubtitleSession } from '../youtube/session';
import { createRuntimeTranslatorClient } from '../youtube/translator-client';
import type { ExtensionMessage, ExtensionSettings, SettingsResponse } from '../shared/messages';

let session: YoutubeSubtitleSession | undefined;

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
    session?.handleCapturedCaptions(detail);
    void scheduleCurrentWindow();
  });
}

function listenForPlayback(): void {
  document.addEventListener('timeupdate', (event) => {
    if (event.target instanceof HTMLVideoElement) {
      void scheduleCurrentWindow(event.target);
    }
  }, true);
}

async function scheduleCurrentWindow(video = document.querySelector('video')): Promise<void> {
  if (!session || !video) {
    return;
  }

  await session.ensureTranslations(video.currentTime * 1000, isCcEnabled());
}

function isCcEnabled(): boolean {
  const button = document.querySelector<HTMLButtonElement>('.ytp-subtitles-button');
  return button?.getAttribute('aria-pressed') === 'true';
}

function createSession(settings: ExtensionSettings): void {
  session?.stop();
  session = new YoutubeSubtitleSession(settings, createRuntimeTranslatorClient());
  session.start();
}

async function boot(): Promise<void> {
  injectMainWorldCapture();
  listenForCaptionCapture();
  listenForPlayback();

  const response = await sendMessage({ type: 'GET_SETTINGS' });

  if (!response.ok) {
    console.warn('Simple Translator settings load failed:', response.error);
    return;
  }

  if (!response.settings.enabled) {
    return;
  }

  createSession(response.settings);
  console.info('Simple Translator enabled:', response.settings.targetLanguage);
}

void boot();
