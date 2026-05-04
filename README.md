# Simple Translator

Chrome MV3 extension for translating YouTube subtitles with AI providers.

## Status

MVP in progress.

Implemented:

- MAIN-world YouTube `/api/timedtext` capture
- `json3` and `vtt` subtitle parsing
- YouTube subtitles menu injection: `AI Translate`
- Native subtitle hiding while AI mode active
- Custom subtitle overlay renderer
- Bottom-right status overlay
- Window-based scheduler: 30s window, 2-window lookahead
- ASR local merge before translation
- Background provider pipeline
- `storage.local` translation cache: 3 day TTL, rotate over budget
- Options page with active provider, model, API key, target language, test button

Providers:

- `openai` → `https://api.openai.com/v1/chat/completions`
- `anthropic` → `https://api.anthropic.com/v1/messages`
- `opencodeZen` → `https://opencode.ai/zen/go/v1/chat/completions`

## Requirements

- Bun
- Chrome / Chromium

## Setup

```bash
bun install
bun run check
```

## Development

```bash
bun run dev
```

Load extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `dist/`
5. Open YouTube, enable captions, open subtitle menu, choose `AI Translate`

## Build

```bash
bun run build
```

Output:

```txt
dist/
```

## Scripts

- `bun run build` - build extension into `dist/`
- `bun run dev` - rebuild on file changes
- `bun run typecheck` - TypeScript check
- `bun run lint` - oxlint
- `bun test` - run unit tests
- `bun run check` - typecheck, lint, tests, build

## Provider setup

Open extension options page and configure:

- Active provider: `openai` / `anthropic` / `opencodeZen`
- Model: preset or custom model id
- API key: stored in `chrome.storage.local`
- Target language: fixed language list

Provider configs are stored in `chrome.storage.sync`.
Provider secrets are stored in `chrome.storage.local`.

## Architecture

```txt
src/
  background/
    index.ts
    cache.ts
    providers/
  content/
    index.ts
  options/
    index.ts
  shared/
  youtube/
    main-world-capture.ts
    caption-parser.ts
    session.ts
    scheduler.ts
    asr-merge.ts
    menu-injection.ts
    native-caption-hider.ts
    subtitle-overlay-renderer.ts
    status-overlay.ts
```

See `SPEC.md` for full design.
