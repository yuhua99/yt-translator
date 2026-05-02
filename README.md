# Simple Translator

Chrome extension for translating YouTube subtitles. Built with TypeScript, Bun, and oxlint.

## Status

MVP in progress.

Implemented:

- YouTube `/api/timedtext` capture from page context
- Manual subtitle parsing and translation scheduling
- ASR subtitle parsing and overlay rendering
- Provider-agnostic background translation pipeline
- Providers:
  - OpenAI-compatible
  - Anthropic
  - opencode Go (`https://opencode.ai/zen/go/v1`)
  - Mock provider for tests
- Settings popup for target language, provider, model, base URL, API key

Known gaps:

- YouTube SPA handling still basic
- Manual renderer may miss caption DOM rebuilds
- ASR native captions are not hidden yet
- No cache yet
- No debug panel yet

## Requirements

- Bun
- Chrome / Chromium browser

## Setup

```bash
bun install
bun run check
```

## Development

```bash
bun run dev
```

Then load extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `dist/`
5. Open YouTube and enable captions

## Build

```bash
bun run build
```

Output goes to:

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

Open popup and configure:

- **Enable translation**: on/off
- **Target language**: e.g. `Traditional Chinese`
- **Provider**:
  - `openai`
  - `anthropic`
  - `opencode-go`
- **Model**: provider model name
- **API key**: stored in `chrome.storage.local`

Provider configs are stored in `chrome.storage.sync`.
Provider secrets are stored in `chrome.storage.local`.

### opencode Go example

```txt
Provider: opencode-go
Model: go
API key: your key
```

Default base URL:

```txt
https://opencode.ai/zen/go/v1
```

### OpenAI example

```txt
Provider: openai
Model: gpt-4.1-mini
API key: your OpenAI API key
```

Default base URL:

```txt
https://api.openai.com/v1
```

### Anthropic example

```txt
Provider: anthropic
Model: claude-sonnet-4-5
API key: your Anthropic API key
```

Default base URL:

```txt
https://api.anthropic.com/v1
```

## Architecture

```txt
public/                     static extension files
scripts/build.ts            Bun build script
src/background/             MV3 service worker
src/background/providers/   provider interface + implementations
src/content/                YouTube content entrypoint
src/popup/                  extension popup
src/shared/                 runtime message types
src/youtube/                YouTube subtitle pipeline
tests/                      Bun unit tests
```

Subtitle flow:

```txt
YouTube player request
  -> MAIN-world XHR/fetch capture
  -> CustomEvent to content script
  -> caption parser
  -> per-video session
  -> scheduler selects time window
  -> background provider translates
  -> manual renderer or ASR overlay displays result
```

Provider flow:

```txt
providerType
  -> config from chrome.storage.sync
  -> secret from chrome.storage.local
  -> createProvider(config, secret)
  -> provider.translateManual(...) or provider.translateAsr(...)
```

## Translation prompts

Prompts live in:

```txt
src/background/providers/prompts.ts
```

- `createManualPrompt()` asks provider to return:

```json
{
  "translations": [{ "id": "segment-id", "text": "translation" }]
}
```

- `createAsrPrompt()` asks provider to return:

```json
{
  "cues": [
    {
      "startMs": 0,
      "endMs": 1000,
      "text": "translation",
      "sourceSegmentIds": ["segment-id"]
    }
  ]
}
```

## Tests

```bash
bun test
```

Current tests cover:

- caption parser
- scheduler
- translation validation
- cache keys
- settings storage
- provider storage
- provider request parsing
- session behavior
- manual cue matching
- ASR cue matching

## Security notes

- API keys are stored only in `chrome.storage.local`.
- Provider configs are stored in `chrome.storage.sync`.
- Content script sends only provider type/model request data; provider secrets stay in background.

## License

Private / unspecified.
