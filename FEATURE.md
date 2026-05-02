# Feature Spec: YouTube Subtitle Translation

## Scope

Build browser extension feature for YouTube subtitle translation only.

Feature code must be provider-agnostic. It only sends provider type to background.

---

## User-facing behavior

User can:

- Enable/disable subtitle translation on YouTube
- Pick target language/style via settings
- Pick AI provider by provider type
- See translated subtitles while video plays
- Pause translation when YouTube CC is off
- Resume translation when CC is on

Supported subtitle modes:

1. Manual / human subtitles
2. ASR / auto-generated subtitles

---

## Must-keep technique: capture YouTube player caption response

YouTube `/api/timedtext` is unreliable when fetched manually. It may return empty body due to YouTube player request context, POT, or experiment flags.

Preferred method:

1. Inject script into MAIN world at `document_start`
2. Monkey-patch `XMLHttpRequest.prototype.open/send`
3. Monkey-patch `window.fetch`
4. Detect requests whose URL contains `/api/timedtext`
5. Let YouTube player make its own request
6. Clone/read response body
7. Dispatch result to isolated world via `CustomEvent`

Event shape:

```ts
interface CaptionsCapturedEventDetail {
  url: string;
  responseText: string;
}
```

Event name:

```ts
const CAPTION_EVENT = 'shinkansen-yt-captions';
```

Reason:

- YouTube player has correct request context
- Extension avoids rebuilding signed/POT caption URL
- Works better across YouTube experiments

---

## Recommended architecture

```txt
src/youtube/
  main-world-capture.ts       # MAIN world /api/timedtext interception
  index.ts                    # content entrypoint and lifecycle
  session.ts                  # per-video session state
  caption-parser.ts           # parse timedtext formats
  caption-types.ts            # shared YouTube subtitle types
  player-state.ts             # video element, CC state, SPA navigation
  scheduler.ts                # time-window translation planner
  translator-client.ts        # sends runtime messages to background
  manual-renderer.ts          # manual subtitle DOM replacement
  asr-overlay-renderer.ts     # ASR custom overlay renderer
  cache-client.ts             # optional cache abstraction
  debug-panel.ts              # optional debug UI

src/background/
  index.ts
  providers/
  subtitle-translation.ts     # provider-agnostic subtitle request handler
  storage.ts
  usage.ts
```

Hard rule:

- Parser does not call provider
- Scheduler does not touch DOM
- Renderer does not know provider
- YouTube content code does not branch on provider type

---

## Core data types

```ts
export type CaptionMode = 'manual' | 'asr';

export interface CaptionTrack {
  videoId: string;
  trackId: string;
  languageCode: string;
  mode: CaptionMode;
}

export interface CaptionSegment {
  id: string;              // stable key: videoId:trackId:index
  index: number;
  startMs: number;
  endMs?: number;
  text: string;
  normalizedText: string;
}

export interface TranslatedCue {
  id: string;
  startMs: number;
  endMs: number;
  sourceText: string;
  translatedText: string;
  sourceSegmentIds: string[];
}

export interface TranslationWindow {
  id: string;              // `${startMs}-${endMs}`
  startMs: number;
  endMs: number;
  priority: 'current' | 'lookahead' | 'background';
}
```

Avoid using `normalizedText` as primary identity. It is useful for lookup/fallback, but repeated subtitles collide. Prefer stable segment ids.

---

## Session lifecycle

Create one session per video.

```ts
class YoutubeSubtitleSession {
  videoId: string;
  track?: CaptionTrack;
  mode?: CaptionMode;
  segments: CaptionSegment[];
  translatedCues: TranslatedCue[];
  inFlightWindows: Set<string>;
  completedWindows: Set<string>;
  abortController: AbortController;

  start(): void;
  stop(): void;
  resetForNavigation(videoId: string): void;
}
```

On video change / SPA navigation:

1. Abort in-flight translation jobs
2. Remove overlay
3. Remove observers/listeners
4. Clear per-video state
5. Reload settings snapshot
6. Start new session

YouTube SPA signals to consider:

- URL `v=` change
- `yt-navigate-finish`
- video element replacement
- new `/api/timedtext` capture

---

## Caption parsing

Parser input:

```ts
interface CapturedCaptionResponse {
  url: string;
  responseText: string;
}
```

Parser output:

```ts
interface ParsedCaptions {
  track: CaptionTrack;
  segments: CaptionSegment[];
}
```

Support formats commonly returned by YouTube timedtext:

- JSON3
- TTML/XML
- SRV-like XML if needed

Parser should:

- Decode HTML entities
- Preserve line breaks if source has them
- Normalize text for fallback matching
- Preserve raw segment order
- Detect ASR via URL params, e.g. `kind=asr`

---

## Translation scheduling

Use time windows rather than translating whole video.

Default:

```ts
const WINDOW_SIZE_MS = 30_000;
const LOOKAHEAD_MS = 10_000;
```

Behavior:

- On play/timeupdate, find current playback time
- Ensure current window is translated
- If remaining translated buffer < lookahead, enqueue next window
- On seek, prioritize new current window
- Deduplicate windows already completed or in-flight
- Abort stale jobs when video/session changes

Recommended queue priority:

1. Current window after seek
2. Current playback window
3. Lookahead window
4. Background prefetch, optional

---

## Manual subtitle path

Manual subtitles usually have stable cue text and duration.

Flow:

```txt
captured timedtext
  -> parse CaptionSegment[]
  -> schedule current window
  -> translate selected segments
  -> map segment id to translated text
  -> replace visible .ytp-caption-segment text
```

Renderer may use YouTube native caption DOM:

- Observe `.ytp-caption-segment`
- Match visible text to segment by current time + normalized text
- Replace text content with translation
- Preserve basic layout

If bilingual mode exists:

- Original text can remain in native caption
- Translation can render as overlay above/below
- Keep mode separate from translation pipeline

---

## ASR subtitle path

ASR captions are rolling captions. YouTube appends small word chunks over time.

Do not rely on replacing `.ytp-caption-segment` for ASR. It causes flicker, partial words, order issues, and repeated reflow.

Preferred ASR flow:

```txt
captured ASR timedtext
  -> parse word/short segments
  -> window scheduler
  -> send timestamped segments to provider
  -> provider returns translated cues with start/end
  -> hide native captions
  -> render custom overlay by video.currentTime
```

ASR translation request:

```ts
interface AsrTranslateRequest {
  providerType: string;
  videoId: string;
  segments: Array<{
    id: string;
    startMs: number;
    text: string;
  }>;
  targetLanguage: string;
}
```

ASR translation response:

```ts
interface AsrTranslateResponse {
  cues: Array<{
    startMs: number;
    endMs: number;
    text: string;
    sourceSegmentIds: string[];
  }>;
}
```

Provider should merge ASR fragments into natural translated cues. Do not translate word-by-word.

Overlay renderer:

- Attach under `#movie_player`
- Sync with `video.currentTime`
- Use YouTube caption font size/family as baseline
- Hide native ASR caption windows while active
- Clear overlay when CC is off

Reading-time compensation:

Chinese translation may need longer display time than source ASR fragments. Consider extending `endMs` based on translated text length, bounded by next cue start.

Example:

```ts
const MIN_READ_MS = 800;
const READ_MS_PER_CJK_CHAR = 180;
```

---

## Provider contract

Content script sends provider-agnostic message to background.

Manual subtitles:

```ts
interface TranslateSubtitleMessage {
  type: 'TRANSLATE_SUBTITLE_AI_PROVIDER';
  providerType: string;
  videoId: string;
  trackId: string;
  items: Array<{
    id: string;
    text: string;
    startMs: number;
    endMs?: number;
  }>;
  targetLanguage: string;
}
```

Response:

```ts
interface TranslateSubtitleResult {
  ok: true;
  translations: Array<{
    id: string;
    text: string;
  }>;
  usage?: ProviderUsage;
}
```

ASR subtitles:

```ts
interface TranslateAsrSubtitleMessage {
  type: 'TRANSLATE_ASR_SUBTITLE_BATCH';
  providerType: string;
  videoId: string;
  trackId: string;
  segments: Array<{
    id: string;
    startMs: number;
    text: string;
  }>;
  targetLanguage: string;
}
```

Response:

```ts
interface TranslateAsrSubtitleResult {
  ok: true;
  cues: Array<{
    startMs: number;
    endMs: number;
    text: string;
    sourceSegmentIds: string[];
  }>;
  usage?: ProviderUsage;
}
```

Background resolves provider:

```txt
providerType
  -> provider config from storage.sync
  -> provider secret from storage.local
  -> createProvider(config, secret)
  -> provider.translate(...)
```

Secrets must stay in `storage.local`.

---

## Translation output protocol

Prefer JSON over delimiter splitting.

Manual output prompt should require:

```json
{
  "translations": [
    { "id": "segment-id-1", "text": "繁體中文翻譯" },
    { "id": "segment-id-2", "text": "繁體中文翻譯" }
  ]
}
```

ASR output prompt should require:

```json
{
  "cues": [
    {
      "startMs": 1200,
      "endMs": 4300,
      "text": "自然合句後的繁體中文字幕",
      "sourceSegmentIds": ["seg-1", "seg-2", "seg-3"]
    }
  ]
}
```

Validation rules:

- Manual response must contain all requested ids
- Unknown ids ignored
- Missing ids can fallback to source text or retry
- ASR cue times must be monotonic
- ASR `endMs` must be greater than `startMs`
- ASR cue must reference known source ids, or be dropped/repaired

---

## Cache design

Cache is optional in MVP, but key design matters.

Do not key only by text. Repeated subtitles collide.

Suggested key material:

```ts
interface SubtitleCacheKey {
  providerType: string;
  model: string;
  videoId: string;
  trackId: string;
  segmentId: string;
  sourceTextHash: string;
  targetLanguage: string;
  promptVersion: string;
}
```

Cache manual segment translations and ASR cue results separately.

---

## Player and CC state

Track:

```ts
interface PlayerState {
  videoId: string;
  currentTimeMs: number;
  playbackRate: number;
  isPlaying: boolean;
  ccEnabled: boolean;
}
```

When CC is disabled:

- Do not send new translation requests
- Hide/clear overlay
- Keep session/cache state

When CC is re-enabled:

- Resume scheduler
- Re-render current cue/window

---

## Debugging hooks

Useful debug fields:

```ts
interface DebugSnapshot {
  videoId: string;
  mode?: CaptionMode;
  segmentCount: number;
  translatedCueCount: number;
  inFlightWindows: string[];
  completedWindows: string[];
  currentTimeMs: number;
  translatedUpToMs: number;
  lastApiMs?: number;
  providerType: string;
}
```

Keep debug panel separate from core logic. Core modules can emit events or expose snapshot.

---

## Known YouTube pitfalls

- YouTube is SPA; URL changes do not reload page.
- Video element can be replaced.
- Caption DOM can be rebuilt often.
- `/api/timedtext` manual fetch may return empty body.
- ASR captions are rolling and unsuitable for direct text replacement.
- CC button off should pause translation requests.
- Caption response may arrive before user starts translation; cache captured response per video if possible.
- Captions may switch language/track mid-video.
- Theater/fullscreen layout changes affect overlay position and font size.

---

## MVP plan

### Phase 1: manual subtitles only

- MAIN world timedtext capture
- Parse captured captions
- Create per-video session
- Window scheduler
- Provider-agnostic manual translate request
- Replace visible native caption segments
- SPA cleanup
- CC pause handling

### Phase 2: ASR

- Detect `kind=asr`
- Timestamped ASR translate request
- Custom overlay renderer
- Native caption hiding
- Reading-time compensation

### Phase 3: quality

- Cache
- Bilingual mode
- Debug panel
- Usage stats
- Better retry/repair for malformed provider JSON

---

## Non-goals for first rewrite

- General webpage translation
- Streaming output
- Google Docs/Drive integration
- Provider-specific UI inside YouTube code
- Legacy migration from old settings
- Complex on-the-fly DOM fallback
