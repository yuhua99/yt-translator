import { describe, expect, test } from 'bun:test';
import { YoutubeSubtitleSession } from '../../src/youtube/session';
import type { TranslatorClient } from '../../src/youtube/translator-client';
import type { ExtensionSettings, TranslateSubtitleResult } from '../../src/shared/messages';

const settings: ExtensionSettings = {
  enabled: true,
  targetLanguage: 'Traditional Chinese',
  providerId: 'mock',
};

function createTranslatorClient(): TranslatorClient & { calls: string[][] } {
  const calls: string[][] = [];

  return {
    calls,
    async translateSubtitle(input): Promise<TranslateSubtitleResult> {
      calls.push(input.segments.map((segment) => segment.id));

      return {
        ok: true,
        translations: input.segments.map((segment) => ({ id: segment.id, text: `zh:${segment.text}` })),
      };
    },
  };
}

describe('YoutubeSubtitleSession', () => {
  test('parses captured manual captions and translates current window', async () => {
    const client = createTranslatorClient();
    const session = new YoutubeSubtitleSession(settings, client);

    session.handleCapturedCaptions({
      url: 'https://www.youtube.com/api/timedtext?v=video-1&lang=en',
      responseText: JSON.stringify({ events: [{ tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: 'Hello' }] }] }),
    });

    await session.ensureTranslations(1000, true);

    expect(session.videoId).toBe('video-1');
    expect(session.mode).toBe('manual');
    expect(client.calls).toEqual([['video-1:en::manual:0']]);
    expect(session.translatedCues).toEqual([
      {
        id: 'video-1:en::manual:0',
        startMs: 1000,
        endMs: 2000,
        sourceText: 'Hello',
        translatedText: 'zh:Hello',
        sourceSegmentIds: ['video-1:en::manual:0'],
      },
    ]);
  });

  test('does not translate when disabled, CC off, ASR, or already completed', async () => {
    const client = createTranslatorClient();
    const session = new YoutubeSubtitleSession(settings, client);

    session.handleCapturedCaptions({
      url: 'https://www.youtube.com/api/timedtext?v=video-1&lang=en&kind=asr',
      responseText: JSON.stringify({ events: [{ tStartMs: 1000, segs: [{ utf8: 'Hello' }] }] }),
    });

    await session.ensureTranslations(1000, true);
    expect(client.calls).toEqual([]);

    session.handleCapturedCaptions({
      url: 'https://www.youtube.com/api/timedtext?v=video-1&lang=en',
      responseText: JSON.stringify({ events: [{ tStartMs: 1000, segs: [{ utf8: 'Hello' }] }] }),
    });

    await session.ensureTranslations(1000, false);
    expect(client.calls).toEqual([]);

    await session.ensureTranslations(1000, true);
    await session.ensureTranslations(1000, true);
    expect(client.calls).toHaveLength(1);
  });

  test('resetForNavigation clears state and aborts in-flight windows', () => {
    const session = new YoutubeSubtitleSession(settings, createTranslatorClient());

    session.handleCapturedCaptions({
      url: 'https://www.youtube.com/api/timedtext?v=video-1&lang=en',
      responseText: JSON.stringify({ events: [{ tStartMs: 1000, segs: [{ utf8: 'Hello' }] }] }),
    });
    session.inFlightWindows.add('0-30000');
    session.completedWindows.add('0-30000');

    session.resetForNavigation('video-2');

    expect(session.videoId).toBe('video-2');
    expect(session.segments).toEqual([]);
    expect(session.translatedCues).toEqual([]);
    expect(session.inFlightWindows.size).toBe(0);
    expect(session.completedWindows.size).toBe(0);
  });
});
