import { parseCapturedCaptions } from './caption-parser';
import { formatProgressMessage, formatSuccessMessage, type TranslationProgressHud } from './progress-hud';
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
    private readonly progressHud?: TranslationProgressHud,
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
    this.progressHud?.clearAll();
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
    this.progressHud?.clear(this.progressId());
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
    this.startProgress();
    this.updateProgress();

    try {
      const translatedIds = this.mode === 'asr'
        ? await this.translateAsrSegments(segments)
        : await this.translateManualSegments(segments);

      for (const id of translatedIds) {
        this.translatedSegmentIds.add(id);
      }

      this.completedWindows.add(window.id);
      this.updateProgress();
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        this.progressHud?.error({ id: this.progressId(), message: getErrorMessage(error) });
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

  private async translateAsrSegments(segments: CaptionSegment[]): Promise<string[]> {
    if (!this.track) {
      return [];
    }

    const result = await this.translatorClient.translateAsrSubtitle({
      providerType: this.settings.providerType,
      videoId: this.videoId,
      track: this.track,
      segments,
      targetLanguage: this.settings.targetLanguage,
    }, this.abortController.signal);
    const translatedIds = new Set<string>();

    for (const cue of result.cues) {
      this.translatedCues.push({
        id: `${this.videoId}:${this.track.trackId}:asr-cue:${cue.startMs}-${cue.endMs}`,
        startMs: cue.startMs,
        endMs: cue.endMs,
        sourceText: segments.filter((segment) => cue.sourceSegmentIds.includes(segment.id)).map((segment) => segment.text).join(' '),
        translatedText: cue.text,
        sourceSegmentIds: cue.sourceSegmentIds,
      });

      for (const id of cue.sourceSegmentIds) {
        translatedIds.add(id);
      }
    }

    return [...translatedIds];
  }

  private segmentsInWindow(window: TranslationWindow): CaptionSegment[] {
    return this.segments.filter((segment) => segment.startMs >= window.startMs && segment.startMs < window.endMs);
  }

  private progressId(): string {
    return `simple-translator:${this.videoId}`;
  }

  private startProgress(): void {
    this.progressHud?.start({
      id: this.progressId(),
      label: '字幕翻譯',
      total: this.segments.length,
    });
  }

  private updateProgress(): void {
    const completed = this.translatedSegmentIds.size;
    const total = this.segments.length;

    if (total > 0 && completed >= total) {
      this.progressHud?.success({ id: this.progressId(), message: formatSuccessMessage(completed, total) });
      return;
    }

    this.progressHud?.update({
      id: this.progressId(),
      completed,
      total,
      message: formatProgressMessage(completed, total),
    });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
