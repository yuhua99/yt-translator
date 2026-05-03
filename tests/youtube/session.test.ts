import { describe, expect, spyOn, test } from 'bun:test';
import { YoutubeSubtitleSession } from '../../src/youtube/session';
import type { TranslationProgressHud } from '../../src/youtube/progress-hud';
import type { TranslatorClient } from '../../src/youtube/translator-client';
import type { ExtensionSettings, TranslateSubtitleResult } from '../../src/shared/messages';

const settings: ExtensionSettings = {
  enabled: true,
  targetLanguage: 'Traditional Chinese',
  providerType: 'mock',
};

function createProgressHud(): TranslationProgressHud & { events: string[] } {
  const events: string[] = [];

  return {
    events,
    start(input) {
      events.push(`start:${input.total}`);
    },
    update(input) {
      events.push(`update:${input.completed}/${input.total}`);
    },
    success(input) {
      events.push(`success:${input.message ?? ''}`);
    },
    error(input) {
      events.push(`error:${input.message}`);
    },
    clear(id) {
      events.push(`clear:${id}`);
    },
    clearAll() {
      events.push('clearAll');
    },
  };
}

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
    async translateAsrSubtitle(input) {
      calls.push(input.segments.map((segment) => segment.id));

      return {
        ok: true,
        cues: input.segments.map((segment) => ({
          startMs: segment.startMs,
          endMs: segment.startMs + 1500,
          text: `asr:${segment.text}`,
          sourceSegmentIds: [segment.id],
        })),
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

  test('does not translate when CC off or already completed', async () => {
    const client = createTranslatorClient();
    const session = new YoutubeSubtitleSession(settings, client);

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

  test('translates ASR captions into timed cues', async () => {
    const client = createTranslatorClient();
    const session = new YoutubeSubtitleSession(settings, client);

    session.handleCapturedCaptions({
      url: 'https://www.youtube.com/api/timedtext?v=video-1&lang=en&kind=asr',
      responseText: JSON.stringify({ events: [{ tStartMs: 1000, segs: [{ utf8: 'Hello' }] }] }),
    });

    await session.ensureTranslations(1000, true);

    expect(session.translatedCues).toEqual([
      {
        id: 'video-1:en::asr:asr-cue:1000-2500',
        startMs: 1000,
        endMs: 2500,
        sourceText: 'Hello',
        translatedText: 'asr:Hello',
        sourceSegmentIds: ['video-1:en::asr:0'],
      },
    ]);
  });

  test('reports translation progress', async () => {
    const client = createTranslatorClient();
    const progressHud = createProgressHud();
    const session = new YoutubeSubtitleSession(settings, client, progressHud);

    session.handleCapturedCaptions({
      url: 'https://www.youtube.com/api/timedtext?v=video-1&lang=en',
      responseText: JSON.stringify({ events: [{ tStartMs: 1000, segs: [{ utf8: 'Hello' }] }] }),
    });

    await session.ensureTranslations(1000, true);

    expect(progressHud.events).toContain('start:1');
    expect(progressHud.events).toContain('update:0/1');
    expect(progressHud.events).toContain('success:完成 1/1');
  });

  test('reports translation errors without throwing', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    const progressHud = createProgressHud();
    const session = new YoutubeSubtitleSession(settings, {
      async translateSubtitle() {
        throw new Error('bad api key');
      },
      async translateAsrSubtitle() {
        throw new Error('bad api key');
      },
    }, progressHud);

    session.handleCapturedCaptions({
      url: 'https://www.youtube.com/api/timedtext?v=video-1&lang=en',
      responseText: JSON.stringify({ events: [{ tStartMs: 1000, segs: [{ utf8: 'Hello' }] }] }),
    });

    await expect(session.ensureTranslations(1000, true)).resolves.toBeUndefined();
    expect(progressHud.events).toContain('error:bad api key');
    warn.mockRestore();
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
