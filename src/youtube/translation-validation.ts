export interface ManualTranslationItem {
  id: string
  text: string
}

export interface AsrCueItem {
  startMs: number
  endMs: number
  text: string
  sourceSegmentIds: string[]
}

export function validateManualTranslations(
  requestedIds: readonly string[],
  translations: readonly ManualTranslationItem[],
): ManualTranslationItem[] {
  const requested = new Set(requestedIds)
  const seen = new Set<string>()
  const valid: ManualTranslationItem[] = []

  for (const item of translations) {
    if (typeof item.text !== 'string' || !requested.has(item.id) || seen.has(item.id)) {
      continue
    }

    seen.add(item.id)
    valid.push(item)
  }

  return valid
}

export function missingManualTranslationIds(
  requestedIds: readonly string[],
  translations: readonly ManualTranslationItem[],
): string[] {
  const translated = new Set(
    validateManualTranslations(requestedIds, translations).map((item) => item.id),
  )
  return requestedIds.filter((id) => !translated.has(id))
}

export function validateAsrCues(
  knownSegmentIds: readonly string[],
  cues: readonly AsrCueItem[],
): AsrCueItem[] {
  const known = new Set(knownSegmentIds)
  const valid: AsrCueItem[] = []
  let previousEndMs = -Infinity

  for (const cue of cues) {
    const sourceSegmentIds = cue.sourceSegmentIds.filter((id) => known.has(id))

    if (
      cue.startMs < previousEndMs ||
      cue.endMs <= cue.startMs ||
      sourceSegmentIds.length === 0 ||
      !cue.text.trim()
    ) {
      continue
    }

    valid.push({ ...cue, sourceSegmentIds })
    previousEndMs = cue.endMs
  }

  return valid
}
