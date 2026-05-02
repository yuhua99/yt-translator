import type { CaptionSegment, CaptionTrack } from './caption-types';
import type { TranslateAsrSubtitleResult, TranslateSubtitleResult } from '../shared/messages';

export interface TranslatorClient {
  translateSubtitle(input: TranslateSubtitleInput, signal: AbortSignal): Promise<TranslateSubtitleResult>;
  translateAsrSubtitle(input: TranslateSubtitleInput, signal: AbortSignal): Promise<TranslateAsrSubtitleResult>;
}

export interface TranslateSubtitleInput {
  providerId: string;
  videoId: string;
  track: CaptionTrack;
  segments: CaptionSegment[];
  targetLanguage: string;
}

export function createRuntimeTranslatorClient(): TranslatorClient {
  return {
    translateSubtitle(input: TranslateSubtitleInput): Promise<TranslateSubtitleResult> {
      return chrome.runtime.sendMessage({
        type: 'TRANSLATE_SUBTITLE_AI_PROVIDER',
        providerId: input.providerId,
        videoId: input.videoId,
        trackId: input.track.trackId,
        targetLanguage: input.targetLanguage,
        items: input.segments.map((segment) => ({
          id: segment.id,
          text: segment.text,
          startMs: segment.startMs,
          endMs: segment.endMs,
        })),
      });
    },
    translateAsrSubtitle(input: TranslateSubtitleInput): Promise<TranslateAsrSubtitleResult> {
      return chrome.runtime.sendMessage({
        type: 'TRANSLATE_ASR_SUBTITLE_BATCH',
        providerId: input.providerId,
        videoId: input.videoId,
        trackId: input.track.trackId,
        targetLanguage: input.targetLanguage,
        segments: input.segments.map((segment) => ({
          id: segment.id,
          text: segment.text,
          startMs: segment.startMs,
        })),
      });
    },
  };
}
