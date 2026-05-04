import { mergeAsrSegments } from './asr-merge';
import { parseCapturedCaptions } from './caption-parser';
import type { CaptionMode, CaptionSegment, CaptionTrack, CapturedCaptionResponse, TranslatedCue } from './caption-types';
import { planTranslationWindows, type TranslationWindow } from './scheduler';
import type { TranslatorClient } from './translator-client';
import type { ExtensionSettings } from '../shared/messages';

export class YoutubeSubtitleSession {
  videoId = '';
  track?: CaptionTrack;
  mode?: CaptionMode;
  segments: CaptionSegment[] = [];
  translatedCues: TranslatedCue[] = [];
  inFlightWindows = new Set<string>();
  completedWindows = new Set<string>();
  abortController = new AbortController();
  translatedSegmentIds = new Set<string>();

  constructor(
    private readonly settings: ExtensionSettings,
    private readonly translatorClient: TranslatorClient,
  ) {}

  start(): void {
    this.abortController = new AbortController();
  }

  stop(): void {
    this.abortController.abort();
    this.inFlightWindows.clear();
  }

  resetForNavigation(videoId: string): void {
    this.stop();
    this.videoId = videoId;
    this.track = undefined;
    this.mode = undefined;
    this.segments = [];
    this.translatedCues = [];
    this.translatedSegmentIds.clear();
    this.completedWindows.clear();
    this.start();
  }

  handleCapturedCaptions(input: CapturedCaptionResponse): void {
    const parsed = parseCapturedCaptions(input);

    if (this.videoId && this.videoId !== parsed.track.videoId) {
      this.resetForNavigation(parsed.track.videoId);
    }

    this.videoId = parsed.track.videoId;
    this.track = parsed.track;
    this.mode = parsed.track.mode;
    this.segments = parsed.segments;
    this.translatedCues = [];
    this.translatedSegmentIds.clear();
    this.inFlightWindows.clear();
    this.completedWindows.clear();
  }

  async ensureTranslations(currentTimeMs: number, ccEnabled: boolean): Promise<void> {
    if (!this.settings.enabled || !this.track) {
      return;
    }

    const windows = planTranslationWindows({
      inFlightWindows: this.inFlightWindows,
      completedWindows: this.completedWindows,
      ccEnabled,
      currentTimeMs,
    });

    await Promise.all(windows.map((window) => this.translateWindow(window)));
  }

  private async translateWindow(window: TranslationWindow): Promise<void> {
    if (!this.track) {
      return;
    }

    const segments = this.segmentsInWindow(window);

    if (segments.length === 0) {
      this.completedWindows.add(window.id);
      return;
    }

    this.inFlightWindows.add(window.id);

    try {
      const translatedIds = this.mode === 'asr'
        ? await this.translateManualSegments(mergeAsrSegments(segments))
        : await this.translateManualSegments(segments);

      for (const id of translatedIds) {
        this.translatedSegmentIds.add(id);
      }

      this.completedWindows.add(window.id);
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        console.warn('Simple Translator translation failed:', error);
      }
    } finally {
      this.inFlightWindows.delete(window.id);
    }
  }

  private async translateManualSegments(segments: CaptionSegment[]): Promise<string[]> {
    if (!this.track) {
      return [];
    }

    const result = await this.translatorClient.translateSubtitle({
      providerType: this.settings.providerType,
      videoId: this.videoId,
      track: this.track,
      segments,
      targetLanguage: this.settings.targetLanguage,
    }, this.abortController.signal);

    const translations = new Map(result.translations.map((item) => [item.id, item.text]));
    const translatedIds: string[] = [];

    for (const segment of segments) {
      const translatedText = translations.get(segment.id);

      if (!translatedText) {
        continue;
      }

      this.translatedCues.push({
        id: segment.id,
        startMs: segment.startMs,
        endMs: segment.endMs ?? segment.startMs + 2_000,
        sourceText: segment.text,
        translatedText,
        sourceSegmentIds: [segment.id],
      });
      translatedIds.push(segment.id);
    }

    return translatedIds;
  }

  private segmentsInWindow(window: TranslationWindow): CaptionSegment[] {
    return this.segments.filter((segment) => segment.startMs >= window.startMs && segment.startMs < window.endMs);
  }
}
