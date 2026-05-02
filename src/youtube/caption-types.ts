export type CaptionMode = 'manual' | 'asr';

export interface CaptionTrack {
  videoId: string;
  trackId: string;
  languageCode: string;
  mode: CaptionMode;
}

export interface CaptionSegment {
  id: string;
  index: number;
  startMs: number;
  endMs?: number;
  text: string;
  normalizedText: string;
}

export interface CapturedCaptionResponse {
  url: string;
  responseText: string;
}

export interface ParsedCaptions {
  track: CaptionTrack;
  segments: CaptionSegment[];
}

export interface TranslatedCue {
  id: string;
  startMs: number;
  endMs: number;
  sourceText: string;
  translatedText: string;
  sourceSegmentIds: string[];
}
