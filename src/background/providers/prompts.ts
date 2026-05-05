import type { AsrTranslateInput, ManualTranslateInput } from './types'

export function createManualPrompt(input: ManualTranslateInput): string {
  return [
    `Translate subtitles to ${input.targetLanguage}.`,
    'Return JSON only in this shape: {"translations":[{"id":"segment-id","text":"translation"}]}',
    'Preserve meaning. Do not add explanations.',
    JSON.stringify({ items: input.items }),
  ].join('\n\n')
}

export function createAsrPrompt(input: AsrTranslateInput): string {
  return [
    `Merge ASR subtitle fragments into natural subtitle cues translated to ${input.targetLanguage}.`,
    'Return JSON only in this shape: {"cues":[{"startMs":0,"endMs":1000,"text":"translation","sourceSegmentIds":["segment-id"]}]}',
    'Cue times must be monotonic. endMs must be greater than startMs. Use source ids from input only.',
    JSON.stringify({ segments: input.segments }),
  ].join('\n\n')
}
