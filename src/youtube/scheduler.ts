export type TranslationPriority = 'current' | 'lookahead' | 'background'

export interface TranslationWindow {
  id: string
  startMs: number
  endMs: number
  priority: TranslationPriority
}

export interface SchedulerState {
  inFlightWindows: ReadonlySet<string>
  completedWindows: ReadonlySet<string>
  ccEnabled: boolean
}

export interface ScheduleInput extends SchedulerState {
  currentTimeMs: number
  durationMs?: number
  windowSizeMs?: number
  lookaheadWindows?: number
  maxPlannedWindows?: number
}

const DEFAULT_WINDOW_SIZE_MS = 30_000
const DEFAULT_LOOKAHEAD_WINDOWS = 2
const DEFAULT_MAX_PLANNED_WINDOWS = 2

export function planTranslationWindows(input: ScheduleInput): TranslationWindow[] {
  if (!input.ccEnabled) return []

  const windowSizeMs = input.windowSizeMs ?? DEFAULT_WINDOW_SIZE_MS
  const lookaheadWindows = input.lookaheadWindows ?? DEFAULT_LOOKAHEAD_WINDOWS
  const maxPlannedWindows = input.maxPlannedWindows ?? DEFAULT_MAX_PLANNED_WINDOWS
  const currentStartMs = windowStart(input.currentTimeMs, windowSizeMs)
  const windows: TranslationWindow[] = []

  for (let offset = 0; offset <= lookaheadWindows; offset += 1) {
    windows.push(
      createWindow(
        currentStartMs + offset * windowSizeMs,
        windowSizeMs,
        input.durationMs,
        offset === 0 ? 'current' : 'lookahead',
      ),
    )
  }

  return dedupePlannedWindows(windows, input).slice(0, maxPlannedWindows)
}

function windowStart(timeMs: number, windowSizeMs: number): number {
  return Math.floor(Math.max(0, timeMs) / windowSizeMs) * windowSizeMs
}

function createWindow(
  startMs: number,
  windowSizeMs: number,
  durationMs: number | undefined,
  priority: TranslationPriority,
): TranslationWindow {
  const endMs =
    durationMs === undefined ? startMs + windowSizeMs : Math.min(startMs + windowSizeMs, durationMs)
  return { id: `${startMs}-${endMs}`, startMs, endMs, priority }
}

function dedupePlannedWindows(
  windows: TranslationWindow[],
  state: SchedulerState,
): TranslationWindow[] {
  const seen = new Set<string>()

  return windows.filter((window) => {
    if (
      window.endMs <= window.startMs ||
      seen.has(window.id) ||
      state.completedWindows.has(window.id) ||
      state.inFlightWindows.has(window.id)
    ) {
      return false
    }

    seen.add(window.id)
    return true
  })
}
