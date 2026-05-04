import type { CaptionSegment } from './caption-types';

const MAX_GAP_MS = 700;
const MAX_CHARS = 120;
const MAX_DURATION_MS = 6_000;
const BREAK_PUNCTUATION = /[.?!。！？]\s*$/;

export function mergeAsrSegments(segments: readonly CaptionSegment[]): CaptionSegment[] {
  const merged: CaptionSegment[] = [];
  let bucket: CaptionSegment[] = [];

  for (const segment of segments) {
    if (bucket.length > 0 && shouldBreak(bucket, segment)) {
      merged.push(createMergedSegment(bucket, merged.length));
      bucket = [];
    }

    bucket.push(segment);

    if (BREAK_PUNCTUATION.test(segment.text)) {
      merged.push(createMergedSegment(bucket, merged.length));
      bucket = [];
    }
  }

  if (bucket.length > 0) {
    merged.push(createMergedSegment(bucket, merged.length));
  }

  return merged;
}

function shouldBreak(bucket: readonly CaptionSegment[], next: CaptionSegment): boolean {
  const first = bucket[0];
  const last = bucket[bucket.length - 1];
  if (!first || !last) return false;

  const gap = next.startMs - (last.endMs ?? last.startMs);
  const textLength = [...bucket.map((segment) => segment.text), next.text].join(' ').length;
  const duration = (next.endMs ?? next.startMs) - first.startMs;

  return gap > MAX_GAP_MS || textLength > MAX_CHARS || duration > MAX_DURATION_MS;
}

function createMergedSegment(bucket: readonly CaptionSegment[], index: number): CaptionSegment {
  const first = bucket[0];
  const last = bucket[bucket.length - 1];
  if (!first || !last) throw new Error('Cannot merge empty ASR bucket');

  const text = bucket.map((segment) => segment.text).join(' ').replace(/\s+/g, ' ').trim();
  const sourceIds = bucket.map((segment) => segment.id).join(',');

  return {
    id: `${first.id}:merged:${index}:${hashSourceIds(sourceIds)}`,
    index,
    startMs: first.startMs,
    endMs: last.endMs ?? last.startMs + 1_500,
    text,
    normalizedText: text.toLowerCase(),
  };
}

function hashSourceIds(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}
