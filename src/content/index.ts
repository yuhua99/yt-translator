import { CAPTION_EVENT, type CaptionsCapturedEventDetail } from '../youtube/caption-capture-event';
import { injectAiTranslateMenu, type AiMenuInjection } from '../youtube/menu-injection';
import { hideNativeCaptions, showNativeCaptions } from '../youtube/native-caption-hider';

import { YoutubeSubtitleSession } from '../youtube/session';
import { showStatusOverlay } from '../youtube/status-overlay';
import { SubtitleOverlayRenderer } from '../youtube/subtitle-overlay-renderer';
import { createRuntimeTranslatorClient } from '../youtube/translator-client';
import type { ExtensionMessage, ExtensionResponse, ExtensionSettings, MessageResponse, SettingsResponse } from '../shared/messages';

let session: YoutubeSubtitleSession | undefined;
let renderer: SubtitleOverlayRenderer | undefined;
let menuInjection: AiMenuInjection | undefined;
let aiModeActive = false;
let lastVideoId = readVideoId();
let animationFrameId: number | undefined;

function sendMessage<TResponse extends ExtensionResponse>(message: ExtensionMessage): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
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

async function activateAiTranslate(): Promise<void> {
  const validation = await sendMessage<MessageResponse>({ type: 'VALIDATE_ACTIVE_PROVIDER' });
  if (!validation.ok) {
    showStatusOverlay(`AI Translate: ${validation.error}`);
    chrome.runtime.openOptionsPage();
    return;
  }

  const response = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' });
  if (!response.ok) {
    showStatusOverlay(`AI Translate: ${response.error}`);
    return;
  }

  aiModeActive = true;
  createSession({ ...response.settings, enabled: true });
  hideNativeCaptions();
  showStatusOverlay('AI Translate: translating');
  void scheduleCurrentWindow();
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

  const ccEnabled = isCcEnabled();
  if (!ccEnabled) {
    deactivateAiTranslate();
    return;
  }

  const currentTimeMs = video.currentTime * 1000;
  hideNativeCaptions();
  await session.ensureTranslations(currentTimeMs, true);
  renderer?.render(session.translatedCues, currentTimeMs);
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
  session = new YoutubeSubtitleSession(settings, createRuntimeTranslatorClient());
  renderer = new SubtitleOverlayRenderer();
  session.start();
}

function readVideoId(): string {
  return new URL(location.href).searchParams.get('v') ?? '';
}

function boot(): void {
  listenForCaptionCapture();
  listenForPlayback();
  listenForNavigation();
  menuInjection = injectAiTranslateMenu(() => {
    void activateAiTranslate();
  });

  window.addEventListener('pagehide', () => {
    menuInjection?.stop();
    session?.stop();
  });
}

boot();
