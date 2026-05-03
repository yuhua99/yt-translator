import { describe, expect, test } from 'bun:test';
import { formatProgressMessage, formatSuccessMessage } from '../../src/youtube/progress-hud';

describe('progress hud messages', () => {
  test('formats running and success progress', () => {
    expect(formatProgressMessage(12, 120)).toBe('翻譯中 12/120');
    expect(formatSuccessMessage(120, 120)).toBe('完成 120/120');
  });
});
