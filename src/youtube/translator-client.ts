import type { CaptionSegment, CaptionTrack } from './caption-types';
import type { TranslateSubtitleResult } from '../shared/messages';

export interface TranslatorClient {
  translateSubtitle(input: TranslateSubtitleInput, signal: AbortSignal): Promise<TranslateSubtitleResult>;
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
  };
}
