import { describe, expect, test } from 'bun:test';
import { CAPTION_EVENT, isTimedTextUrl } from '../../src/youtube/caption-capture-event';

describe('caption capture event', () => {
  test('uses feature-specified event name', () => {
    expect(CAPTION_EVENT).toBe('shinkansen-yt-captions');
  });

  test('detects YouTube timedtext URLs only', () => {
    expect(isTimedTextUrl('https://www.youtube.com/api/timedtext?v=abc')).toBe(true);
    expect(isTimedTextUrl('https://www.youtube.com/youtubei/v1/player')).toBe(false);
  });
});
