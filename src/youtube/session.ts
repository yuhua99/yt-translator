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
      translatedUpToMs: this.translatedUpToMs(),
    });

    await Promise.all(windows.map((window) => this.translateWindow(window)));
  }

  translatedUpToMs(): number {
    return this.translatedCues.reduce((max, cue) => Math.max(max, cue.endMs), 0);
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
      if (this.mode === 'asr') {
        await this.translateAsrSegments(segments);
      } else {
        await this.translateManualSegments(segments);
      }

      this.completedWindows.add(window.id);
    } finally {
      this.inFlightWindows.delete(window.id);
    }
  }

  private async translateManualSegments(segments: CaptionSegment[]): Promise<void> {
    if (!this.track) {
      return;
    }

    const result = await this.translatorClient.translateSubtitle({
      providerType: this.settings.providerType,
      videoId: this.videoId,
      track: this.track,
      segments,
      targetLanguage: this.settings.targetLanguage,
    }, this.abortController.signal);

    const translations = new Map(result.translations.map((item) => [item.id, item.text]));

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
    }
  }

  private async translateAsrSegments(segments: CaptionSegment[]): Promise<void> {
    if (!this.track) {
      return;
    }

    const result = await this.translatorClient.translateAsrSubtitle({
      providerType: this.settings.providerType,
      videoId: this.videoId,
      track: this.track,
      segments,
      targetLanguage: this.settings.targetLanguage,
    }, this.abortController.signal);

    for (const cue of result.cues) {
      this.translatedCues.push({
        id: `${this.videoId}:${this.track.trackId}:asr-cue:${cue.startMs}-${cue.endMs}`,
        startMs: cue.startMs,
        endMs: cue.endMs,
        sourceText: segments.filter((segment) => cue.sourceSegmentIds.includes(segment.id)).map((segment) => segment.text).join(' '),
        translatedText: cue.text,
        sourceSegmentIds: cue.sourceSegmentIds,
      });
    }
  }

  private segmentsInWindow(window: TranslationWindow): CaptionSegment[] {
    return this.segments.filter((segment) => segment.startMs >= window.startMs && segment.startMs < window.endMs);
  }
}
