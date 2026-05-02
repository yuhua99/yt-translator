export type TranslationPriority = 'current' | 'lookahead' | 'background';

export interface TranslationWindow {
  id: string;
  startMs: number;
  endMs: number;
  priority: TranslationPriority;
}

export interface SchedulerState {
  inFlightWindows: ReadonlySet<string>;
  completedWindows: ReadonlySet<string>;
  ccEnabled: boolean;
}

export interface ScheduleInput extends SchedulerState {
  currentTimeMs: number;
  translatedUpToMs: number;
  durationMs?: number;
  isSeek?: boolean;
  windowSizeMs?: number;
  lookaheadMs?: number;
}

const DEFAULT_WINDOW_SIZE_MS = 30_000;
const DEFAULT_LOOKAHEAD_MS = 10_000;

export function planTranslationWindows(input: ScheduleInput): TranslationWindow[] {
  if (!input.ccEnabled) {
    return [];
  }

  const windowSizeMs = input.windowSizeMs ?? DEFAULT_WINDOW_SIZE_MS;
  const lookaheadMs = input.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
  const current = createWindow(windowStart(input.currentTimeMs, windowSizeMs), windowSizeMs, input.durationMs, 'current');
  const windows = [current];

  if (input.translatedUpToMs - input.currentTimeMs < lookaheadMs) {
    windows.push(createWindow(current.endMs, windowSizeMs, input.durationMs, 'lookahead'));
  }

  return dedupePlannedWindows(windows, input);
}

function windowStart(timeMs: number, windowSizeMs: number): number {
  return Math.floor(Math.max(0, timeMs) / windowSizeMs) * windowSizeMs;
}

function createWindow(startMs: number, windowSizeMs: number, durationMs: number | undefined, priority: TranslationPriority): TranslationWindow {
  const endMs = durationMs === undefined ? startMs + windowSizeMs : Math.min(startMs + windowSizeMs, durationMs);
  return { id: `${startMs}-${endMs}`, startMs, endMs, priority };
}

function dedupePlannedWindows(windows: TranslationWindow[], state: SchedulerState): TranslationWindow[] {
  const seen = new Set<string>();

  return windows.filter((window) => {
    if (window.endMs <= window.startMs || seen.has(window.id) || state.completedWindows.has(window.id) || state.inFlightWindows.has(window.id)) {
      return false;
    }

    seen.add(window.id);
    return true;
  });
}
