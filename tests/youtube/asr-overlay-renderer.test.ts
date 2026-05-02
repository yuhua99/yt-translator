import { describe, expect, test } from 'bun:test';
import { findActiveCue } from '../../src/youtube/asr-overlay-renderer';
import type { TranslatedCue } from '../../src/youtube/caption-types';

const cues: TranslatedCue[] = [
  { id: 'a', startMs: 0, endMs: 1000, sourceText: 'a', translatedText: '一', sourceSegmentIds: ['a'] },
  { id: 'b', startMs: 1500, endMs: 2500, sourceText: 'b', translatedText: '二', sourceSegmentIds: ['b'] },
];

describe('findActiveCue', () => {
  test('returns cue active at current time', () => {
    expect(findActiveCue(cues, 500)?.id).toBe('a');
    expect(findActiveCue(cues, 2000)?.id).toBe('b');
  });

  test('returns undefined between cues', () => {
    expect(findActiveCue(cues, 1200)).toBeUndefined();
  });
});
