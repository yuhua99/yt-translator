import { CAPTION_EVENT, CAPTION_REQUEST_EVENT, type CaptionsCapturedEventDetail } from '../youtube/caption-capture-event';
import { hideNativeCaptions, showNativeCaptions } from '../youtube/native-caption-hider';

import { YoutubeSubtitleSession } from '../youtube/session';
import { showStatusOverlay } from '../youtube/status-overlay';
import { SubtitleOverlayRenderer } from '../youtube/subtitle-overlay-renderer';
import { createRuntimeTranslatorClient, type TranslatorClient } from '../youtube/translator-client';
import type { ExtensionMessage, ExtensionResponse, ExtensionSettings, MessageResponse, SettingsResponse } from '../shared/messages';

let session: YoutubeSubtitleSession | undefined;
let renderer: SubtitleOverlayRenderer | undefined;
let aiModeActive = false;
let lastVideoId = readVideoId();
let animationFrameId: number | undefined;
let lastCaptionRequestAt = 0;
let suppressCcOffUntil = 0;
let autoCcToggled = false;

function sendMessage<TResponse extends ExtensionResponse>(message: ExtensionMessage): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
}

function listenForCaptionCapture(): void {
  window.addEventListener(CAPTION_EVENT, (event) => {
    const detail = (event as CustomEvent<CaptionsCapturedEventDetail>).detail;
    if (detail) handleCaptionCapture(detail);
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data as { source?: string; type?: string; detail?: CaptionsCapturedEventDetail };
    if (data.source === 'simple-translator' && data.type === CAPTION_EVENT && data.detail) {
      handleCaptionCapture(data.detail);
    }
  });
}

function handleCaptionCapture(detail: CaptionsCapturedEventDetail): void {
  if (!session || !detail.responseText) return;

  session.handleCapturedCaptions(detail);
  showStatusOverlay(`AI Translate: captions captured, ${session.segments.length} segments, ${detail.responseText.length} chars, ${session.mode ?? 'unknown'}, ${shortUrl(detail.url)}`);
  void scheduleCurrentWindow();
}

function listenForPlayback(): void {
  document.addEventListener('timeupdate', (event) => {
    if (event.target instanceof HTMLVideoElement) {
      void scheduleCurrentWindow(event.target);
    }
  }, true);

  document.addEventListener('seeked', (event) => {
    if (event.target instanceof HTMLVideoElement) {
      void scheduleCurrentWindow(event.target);
    }
  }, true);
}

function listenForNavigation(): void {
  window.addEventListener('yt-navigate-finish', handleMaybeVideoChanged);
  window.setInterval(handleMaybeVideoChanged, 1_000);
}

function listenForSettingsChanges(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.settings) return;
    const nextSettings = changes.settings.newValue as ExtensionSettings | undefined;
    if (!nextSettings) return;

    if (nextSettings.enabled) {
      void activateAiTranslate(nextSettings);
    } else {
      deactivateAiTranslate();
    }
  });
}

function handleMaybeVideoChanged(): void {
  const videoId = readVideoId();
  if (videoId === lastVideoId) return;

  lastVideoId = videoId;
  renderer?.clear();

  if (!aiModeActive) {
    session?.stop();
    return;
  }

  session?.resetForNavigation(videoId);
  hideNativeCaptions();
  showStatusOverlay('AI Translate: waiting for captions');
}

async function activateAiTranslate(settingsOverride?: ExtensionSettings): Promise<void> {
  const validation = await sendMessage<MessageResponse>({ type: 'VALIDATE_ACTIVE_PROVIDER' });
  if (!validation.ok) {
    showStatusOverlay(`AI Translate: ${validation.error}`);
    chrome.runtime.openOptionsPage();
    return;
  }

  const settings = settingsOverride ?? await loadSettingsForActivation();
  if (!settings) return;

  aiModeActive = true;
  createSession({ ...settings, enabled: true });
  hideNativeCaptions();
  autoCcToggled = false;
  showStatusOverlay('AI Translate: active, waiting for player caption XHR');
  requestCurrentCaptions();
  void scheduleCurrentWindow();
  window.setTimeout(() => {
    if (aiModeActive && (!session?.track || session.segments.length === 0)) {
      showStatusOverlay('AI Translate: no captured captions, reloading YouTube CC');
      void forceSubtitleReload();
    }
  }, 1_000);
  startRenderLoop();
}

function deactivateAiTranslate(): void {
  aiModeActive = false;
  session?.stop();
  session = undefined;
  renderer?.clear();
  showNativeCaptions();
  stopRenderLoop();
}

async function scheduleCurrentWindow(video = document.querySelector('video')): Promise<void> {
  if (!aiModeActive || !session || !video) return;

  if (!session.track) {
    showStatusOverlay('AI Translate: no caption track yet, waiting for player XHR');
    requestCurrentCaptions();
  }

  const ccEnabled = isCcEnabled();
  if (!ccEnabled) {
    if (Date.now() < suppressCcOffUntil) return;
    void setEnabledSetting(false);
    deactivateAiTranslate();
    return;
  }

  const currentTimeMs = video.currentTime * 1000;
  hideNativeCaptions();
  const before = session.translatedCues.length;
  await session.ensureTranslations(currentTimeMs, true);
  const after = session.translatedCues.length;
  renderer?.render(session.translatedCues, currentTimeMs);

  if (session.track) {
    showStatusOverlay(`AI Translate: track ${session.track.languageCode}/${session.mode}, segments ${session.segments.length}, translated ${after}${after === before ? '' : ` (+${after - before})`}`);
  }
}

function requestCurrentCaptions(): void {
  const now = Date.now();
  if (now - lastCaptionRequestAt < 1_000) return;
  lastCaptionRequestAt = now;
  window.dispatchEvent(new CustomEvent(CAPTION_REQUEST_EVENT));
  window.postMessage({ source: 'simple-translator', type: CAPTION_REQUEST_EVENT }, '*');
}

async function forceSubtitleReload(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('.ytp-subtitles-button');
  if (!button) {
    showStatusOverlay('AI Translate: CC button not found');
    return;
  }

  const isOn = button.getAttribute('aria-pressed') === 'true';
  suppressCcOffUntil = Date.now() + 1_500;

  if (!isOn) {
    if (autoCcToggled) {
      showStatusOverlay('AI Translate: CC off, already auto-toggled once');
      return;
    }

    autoCcToggled = true;
    showStatusOverlay('AI Translate: opening YouTube CC to trigger captions');
    button.click();
    return;
  }

  showStatusOverlay('AI Translate: toggling YouTube CC to trigger captions');
  button.click();
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  if (aiModeActive) button.click();
}

function startRenderLoop(): void {
  if (animationFrameId !== undefined) return;

  const render = () => {
    const video = document.querySelector('video');
    if (aiModeActive && session && video) {
      renderer?.render(session.translatedCues, video.currentTime * 1000);
    }
    animationFrameId = window.requestAnimationFrame(render);
  };

  animationFrameId = window.requestAnimationFrame(render);
}

function stopRenderLoop(): void {
  if (animationFrameId === undefined) return;
  window.cancelAnimationFrame(animationFrameId);
  animationFrameId = undefined;
}

function isCcEnabled(): boolean {
  const button = document.querySelector<HTMLButtonElement>('.ytp-subtitles-button');
  return button?.getAttribute('aria-pressed') !== 'false';
}

function createSession(settings: ExtensionSettings): void {
  session?.stop();
  renderer?.clear();
  session = new YoutubeSubtitleSession(settings, createDebugTranslatorClient(createRuntimeTranslatorClient()));
  renderer = new SubtitleOverlayRenderer();
  session.start();
}

function createDebugTranslatorClient(client: TranslatorClient): TranslatorClient {
  return {
    async translateSubtitle(input, signal) {
      showStatusOverlay(`AI Translate: sending ${input.segments.length} segments to ${input.providerType}`);
      const result = await client.translateSubtitle(input, signal);
      if (!result.ok) {
        showStatusOverlay(`AI Translate API error: ${result.error}`);
        throw new Error(result.error);
      }
      showStatusOverlay(`AI Translate: API returned ${result.translations.length} translations`);
      return result;
    },
    async translateAsrSubtitle(input, signal) {
      showStatusOverlay(`AI Translate: sending ${input.segments.length} ASR segments to ${input.providerType}`);
      const result = await client.translateAsrSubtitle(input, signal);
      if (!result.ok) {
        showStatusOverlay(`AI Translate API error: ${result.error}`);
        throw new Error(result.error);
      }
      showStatusOverlay(`AI Translate: API returned ${result.cues.length} ASR cues`);
      return result;
    },
  };
}

function shortUrl(url: string): string {
  if (url.startsWith('simple-translator:')) return url;
  try {
    const parsedUrl = new URL(url, location.href);
    return `${parsedUrl.pathname}?lang=${parsedUrl.searchParams.get('lang') ?? '-'}&fmt=${parsedUrl.searchParams.get('fmt') ?? '-'}`;
  } catch {
    return url.slice(0, 80);
  }
}

function readVideoId(): string {
  return new URL(location.href).searchParams.get('v') ?? '';
}

async function setEnabledSetting(enabled: boolean): Promise<void> {
  const response = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
  if (!response.ok || response.settings.enabled === enabled) return;

  await sendMessage<SettingsResponse>({ type: 'SET_SETTINGS', settings: { ...response.settings, enabled } });
}

async function loadSettingsForActivation(): Promise<ExtensionSettings | undefined> {
  const response = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
  if (!response.ok) {
    showStatusOverlay(`AI Translate: ${response.error}`);
    return undefined;
  }

  return response.settings;
}

async function applyStoredEnabledState(): Promise<void> {
  const response = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
  if (!response.ok) return;

  if (response.settings.enabled) {
    await activateAiTranslate(response.settings);
  }
}

function boot(): void {
  listenForCaptionCapture();
  listenForPlayback();
  listenForNavigation();
  listenForSettingsChanges();
  void applyStoredEnabledState();

  window.addEventListener('pagehide', () => {
    session?.stop();
  });
}

boot();
