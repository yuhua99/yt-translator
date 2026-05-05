import { describe, expect, test } from 'bun:test'
import { planTranslationWindows } from '../../src/youtube/scheduler'

const emptyState = {
  inFlightWindows: new Set<string>(),
  completedWindows: new Set<string>(),
}

describe('planTranslationWindows', () => {
  test('plans current window and lookahead when buffer low', () => {
    expect(
      planTranslationWindows({
        ...emptyState,
        ccEnabled: true,
        currentTimeMs: 12_000,
        translatedUpToMs: 15_000,
      }),
    ).toEqual([
      { id: '0-30000', startMs: 0, endMs: 30_000, priority: 'current' },
      { id: '30000-60000', startMs: 30_000, endMs: 60_000, priority: 'lookahead' },
    ])
  })

  test('returns nothing when CC off', () => {
    expect(
      planTranslationWindows({
        ...emptyState,
        ccEnabled: false,
        currentTimeMs: 12_000,
        translatedUpToMs: 0,
      }),
    ).toEqual([])
  })

  test('bounds window by duration', () => {
    expect(
      planTranslationWindows({
        ...emptyState,
        ccEnabled: true,
        currentTimeMs: 50_000,
        translatedUpToMs: 50_000,
        durationMs: 65_000,
      }),
    ).toEqual([
      { id: '30000-60000', startMs: 30_000, endMs: 60_000, priority: 'current' },
      { id: '60000-65000', startMs: 60_000, endMs: 65_000, priority: 'lookahead' },
    ])
  })
})
