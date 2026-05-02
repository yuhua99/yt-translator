import { describe, expect, test } from 'bun:test';
import { findTranslatedCue } from '../../src/youtube/manual-renderer';
import type { TranslatedCue } from '../../src/youtube/caption-types';

const cues: TranslatedCue[] = [
  {
    id: 'a',
    startMs: 0,
    endMs: 1000,
    sourceText: 'Hello',
    translatedText: '你好',
    sourceSegmentIds: ['a'],
  },
  {
    id: 'b',
    startMs: 2000,
    endMs: 3000,
    sourceText: 'Hello',
    translatedText: '哈囉',
    sourceSegmentIds: ['b'],
  },
];

describe('findTranslatedCue', () => {
  test('matches by time and normalized source text', () => {
    expect(findTranslatedCue(cues, 500, ' hello ')?.translatedText).toBe('你好');
    expect(findTranslatedCue(cues, 2500, 'Hello')?.translatedText).toBe('哈囉');
  });

  test('does not match repeated text outside cue time', () => {
    expect(findTranslatedCue(cues, 1500, 'Hello')).toBeUndefined();
  });
});
