# Simple Translator

Chrome extension template using TypeScript, Bun, and oxlint.

## Setup

```bash
bun install
bun run check
```

## Development

```bash
bun run dev
```

Then load `dist/` in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repo's `dist/` folder

## Scripts

- `bun run build` - build extension into `dist/`
- `bun run dev` - rebuild on file changes
- `bun run typecheck` - TypeScript check
- `bun run lint` - oxlint
- `bun run check` - typecheck, lint, build

## Structure

```txt
public/              static extension files
src/background/      MV3 service worker
src/content/         YouTube content script
src/popup/           extension popup
src/shared/          shared types/messages
scripts/build.ts     Bun build script
```
