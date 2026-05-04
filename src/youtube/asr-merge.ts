import type { CaptionSegment } from './caption-types';

const BREAK_WORDS = new Set([
  'mhm', 'um', '>>', '- ',
  'in fact', 'such as', 'or even', 'get me', "well i'm",
  "i didn't", 'i know', 'i need', 'i will', "i'll", 'i mean',
  'you are', 'what does', 'no problem', 'as we', 'if you',
  'hello', 'okay', 'oh', 'yep', 'yes', 'hey', 'hi', 'yeah',
  'essentially', 'because', 'and', 'but', 'which', 'so',
  'where', 'what', 'now', 'or', 'how', 'after',
]);
const SKIP_WORDS = new Set(['uh']);
const END_WORDS = ['in', 'is', 'and', 'are', 'not', 'an', 'a', 'some', 'the',
  'but', 'our', 'for', 'of', 'if', 'his', 'her', 'my', 'noticed', 'come',
  'mean', 'why', 'this', 'has', 'make', 'gpt', 'p.m', 'a.m'];
const START_WORDS = ['or', 'to', 'in', 'has', 'of', 'are', 'is', 'lines',
  'with', 'days', 'years', 'tokens'];

const BREAK_MIN_TIME_MS = 300;
const MIN_INTERVAL_MS = 1_000;
const MIN_WORD_LENGTH = 3;
const SENTENCE_MIN_WORD = 20;
const MAX_WORDS = 30;
const FALLBACK_END_MS = 1_500;

interface AsrEvent {
  text: string;
  startMs: number;
  isBreak: boolean;
  source: CaptionSegment;
}

export function mergeAsrSegments(segments: readonly CaptionSegment[]): CaptionSegment[] {
  if (segments.length === 0) return [];

  const events = segments.map((segment) => ({
    text: segment.text,
    startMs: segment.startMs,
    isBreak: false,
    source: segment,
  }));

  const split = initialSplit(events);
  const merged = mergeBoundaryGroups(split);
  const compact = mergeShortGroups(merged);

  return compact.map((group, index) => createMergedSegment(group, compact[index + 1], index));
}

function initialSplit(events: AsrEvent[]): AsrEvent[][] {
  if (events.length === 0) return [];

  let baseMs = events[0]?.startMs ?? 0;
  const output: AsrEvent[][] = [];
  let current: AsrEvent[] = [];

  const pushBreak = (lead: AsrEvent, group: AsrEvent[]) => {
    baseMs = lead.startMs;
    output.push(current);
    current = group;
    if (group[0]) group[0].isBreak = true;
  };

  for (let index = 0; index < events.length; index += 1) {
    const currentEvent = events[index];
    if (!currentEvent) continue;

    const nextEvent = events[index + 1];
    const elapsed = currentEvent.startMs - baseMs;
    const trimmed = currentEvent.text.trim().toLowerCase();

    if (BREAK_WORDS.has(trimmed) && elapsed > BREAK_MIN_TIME_MS) {
      pushBreak(currentEvent, [currentEvent]);
      continue;
    }

    if (nextEvent && BREAK_WORDS.has((currentEvent.text + nextEvent.text).trim().toLowerCase()) && elapsed > BREAK_MIN_TIME_MS) {
      pushBreak(currentEvent, [currentEvent, nextEvent]);
      index += 1;
      continue;
    }

    if (SKIP_WORDS.has(trimmed) && nextEvent) {
      baseMs = nextEvent.startMs;
      current.push(nextEvent);
      index += 1;
      continue;
    }

    if (elapsed <= MIN_INTERVAL_MS) {
      baseMs = currentEvent.startMs;
      current.push(currentEvent);
      continue;
    }

    output.push(current);
    current = [currentEvent];
    baseMs = currentEvent.startMs;
  }

  if (current.length > 0) output.push(current);
  return output.filter((group) => group.length > 0);
}

function mergeBoundaryGroups(groups: AsrEvent[][]): AsrEvent[][] {
  if (groups.length <= 1) return groups;

  const startPattern = new RegExp(`^\\s*(${START_WORDS.join('|')})$`, 'i');
  const endPattern = new RegExp(`\\b(${END_WORDS.join('|')})\\s*$`, 'i');
  const result: AsrEvent[][] = [groups[0] ?? []];

  for (let index = 0; index < groups.length - 1; index += 1) {
    const current = result[result.length - 1];
    const currentSource = groups[index];
    const next = groups[index + 1];
    const last = currentSource?.[currentSource.length - 1];
    const nextFirst = next?.[0];

    if (!current || !last || !next || !nextFirst) continue;

    const gap = nextFirst.startMs - last.startMs;
    const matched = startPattern.test(nextFirst.text) || endPattern.test(last.text);
    const wordCount = [...current, ...next].map((event) => event.text).join('').split(/\s+/).filter(Boolean).length;

    if (matched && !nextFirst.isBreak && gap <= MIN_INTERVAL_MS && wordCount <= MAX_WORDS) {
      current.push(...next);
      continue;
    }

    result.push(next);
  }

  return result.filter((group) => group.length > 0);
}

function mergeShortGroups(groups: AsrEvent[][]): AsrEvent[][] {
  const output = [...groups];

  for (let index = output.length - 1; index > 0; index -= 1) {
    const current = output[index];
    const previous = output[index - 1];
    const currentFirst = current?.[0];
    const previousLast = previous?.[previous.length - 1];

    if (!current || !previous || !currentFirst || !previousLast) continue;
    if (current.length > MIN_WORD_LENGTH) continue;
    if (current.length + previous.length >= SENTENCE_MIN_WORD) continue;
    if (currentFirst.startMs - previousLast.startMs > MIN_INTERVAL_MS) continue;
    if (currentFirst.isBreak) continue;

    previous.push(...current);
    output.splice(index, 1);
  }

  return output;
}

function createMergedSegment(group: readonly AsrEvent[], nextGroup: readonly AsrEvent[] | undefined, index: number): CaptionSegment {
  const first = group[0];
  const last = group[group.length - 1];
  if (!first || !last) throw new Error('Cannot merge empty ASR group');

  const text = group.map((event) => event.text).join('').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const sourceIds = group.map((event) => event.source.id).join(',');
  const nextStartMs = nextGroup?.[0]?.startMs;

  return {
    id: `${first.source.id}:merged:${index}:${hashSourceIds(sourceIds)}`,
    index,
    startMs: first.startMs,
    endMs: nextStartMs ?? last.source.endMs ?? last.startMs + FALLBACK_END_MS,
    text,
    normalizedText: text.toLowerCase(),
  };
}

function hashSourceIds(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36);
}
