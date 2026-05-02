import { describe, expect, test } from 'bun:test';
import { missingManualTranslationIds, validateAsrCues, validateManualTranslations } from '../../src/youtube/translation-validation';

describe('validateManualTranslations', () => {
  test('keeps requested ids, ignores unknown ids and duplicates', () => {
    const valid = validateManualTranslations(['a', 'b'], [
      { id: 'a', text: 'A' },
      { id: 'x', text: 'X' },
      { id: 'a', text: 'A duplicate' },
      { id: 'b', text: 'B' },
    ]);

    expect(valid).toEqual([
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ]);
  });

  test('reports missing requested ids', () => {
    expect(missingManualTranslationIds(['a', 'b', 'c'], [{ id: 'a', text: 'A' }])).toEqual(['b', 'c']);
  });
});

describe('validateAsrCues', () => {
  test('keeps non-overlapping valid cues and filters unknown source ids', () => {
    const valid = validateAsrCues(['s1', 's2', 's3'], [
      { startMs: 0, endMs: 1000, text: 'One', sourceSegmentIds: ['s1', 'bad'] },
      { startMs: 1200, endMs: 1100, text: 'bad time', sourceSegmentIds: ['s2'] },
      { startMs: 500, endMs: 1300, text: 'non monotonic', sourceSegmentIds: ['s2'] },
      { startMs: 1500, endMs: 2000, text: 'Two', sourceSegmentIds: ['s2', 's3'] },
      { startMs: 2200, endMs: 2400, text: 'unknown only', sourceSegmentIds: ['bad'] },
    ]);

    expect(valid).toEqual([
      { startMs: 0, endMs: 1000, text: 'One', sourceSegmentIds: ['s1'] },
      { startMs: 1500, endMs: 2000, text: 'Two', sourceSegmentIds: ['s2', 's3'] },
    ]);
  });
});
