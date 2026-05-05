import { describe, expect, test } from 'bun:test'
import { mergeAsrSegments } from '../../src/youtube/asr-merge'
import type { CaptionSegment } from '../../src/youtube/caption-types'

function segment(index: number, startMs: number, text: string): CaptionSegment {
  return {
    id: `s${index}`,
    index,
    startMs,
    text,
    normalizedText: text.toLowerCase(),
  }
}

describe('mergeAsrSegments', () => {
  test('uses next merged group start as cue end', () => {
    const merged = mergeAsrSegments([
      segment(0, 0, 'I '),
      segment(1, 400, 'think '),
      segment(2, 1800, 'because '),
      segment(3, 2200, 'it works'),
    ])

    expect(merged.length).toBeGreaterThanOrEqual(2)
    expect(merged[0]?.endMs).toBe(1800)
  })
})
