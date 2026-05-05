import type { AsrTranslateInput, ManualTranslateInput } from './types'

export function createManualPrompt(input: ManualTranslateInput): string {
  const parts: string[] = [
    `Translate subtitles to ${input.targetLanguage}.`,
    'Return JSON only in this shape: {"translations":[{"id":"segment-id","text":"translation"}]}',
    'Preserve meaning. Do not add explanations.',
  ]

  if (input.contextBefore?.length) {
    parts.push(
      'Context before (do NOT translate, for continuity only):',
      JSON.stringify({ contextBefore: input.contextBefore }),
    )
  }

  if (input.contextAfter?.length) {
    parts.push(
      'Context after (do NOT translate, for continuity only):',
      JSON.stringify({ contextAfter: input.contextAfter }),
    )
  }

  parts.push(JSON.stringify({ items: input.items }))
  return parts.join('\n\n')
}

export function createAsrPrompt(input: AsrTranslateInput): string {
  const parts: string[] = [
    `Merge ASR subtitle fragments into natural subtitle cues translated to ${input.targetLanguage}.`,
    'Return JSON only in this shape: {"cues":[{"startMs":0,"endMs":1000,"text":"translation","sourceSegmentIds":["segment-id"]}]}',
    'Cue times must be monotonic. endMs must be greater than startMs. Use source ids from input only.',
  ]

  if (input.contextBefore?.length) {
    parts.push(
      'Context before (do NOT translate, for continuity only):',
      JSON.stringify({ contextBefore: input.contextBefore }),
    )
  }

  if (input.contextAfter?.length) {
    parts.push(
      'Context after (do NOT translate, for continuity only):',
      JSON.stringify({ contextAfter: input.contextAfter }),
    )
  }

  parts.push(JSON.stringify({ segments: input.segments }))
  return parts.join('\n\n')
}
