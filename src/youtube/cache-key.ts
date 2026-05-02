export interface SubtitleCacheKeyInput {
  providerType: string;
  model: string;
  videoId: string;
  trackId: string;
  segmentId: string;
  sourceTextHash: string;
  targetLanguage: string;
  promptVersion: string;
}

export function createSubtitleCacheKey(input: SubtitleCacheKeyInput): string {
  return [
    'subtitle',
    input.providerType,
    input.model,
    input.videoId,
    input.trackId,
    input.segmentId,
    input.sourceTextHash,
    input.targetLanguage,
    input.promptVersion,
  ].map(encodeURIComponent).join(':');
}
