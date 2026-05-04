import type { TranslatedCue } from './caption-types';

const OVERLAY_ID = 'simple-translator-subtitle-overlay';

export function findActiveCue(cues: readonly TranslatedCue[], currentTimeMs: number): TranslatedCue | undefined {
  const sortedCues = [...cues].sort((left, right) => left.startMs - right.startMs);

  for (let index = 0; index < sortedCues.length; index += 1) {
    const cue = sortedCues[index];
    if (!cue) continue;

    const nextStartMs = sortedCues[index + 1]?.startMs ?? Infinity;
    const effectiveEndMs = Math.min(cue.endMs, nextStartMs);
    if (currentTimeMs >= cue.startMs && currentTimeMs < effectiveEndMs) return cue;
  }

  return undefined;
}

export class SubtitleOverlayRenderer {
  render(cues: readonly TranslatedCue[], currentTimeMs: number): void {
    const cue = findActiveCue(cues, currentTimeMs);
    const overlay = this.ensureOverlay();
    overlay.textContent = cue?.translatedText ?? '';
    overlay.hidden = !cue;
  }

  clear(): void {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  private ensureOverlay(): HTMLElement {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) return existing;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'absolute';
    overlay.style.left = '50%';
    overlay.style.bottom = '10%';
    overlay.style.transform = 'translateX(-50%)';
    overlay.style.zIndex = '60';
    overlay.style.maxWidth = '82%';
    overlay.style.padding = '4px 8px';
    overlay.style.borderRadius = '4px';
    overlay.style.color = 'white';
    overlay.style.background = 'rgba(8, 8, 8, 0.75)';
    overlay.style.font = readNativeFont();
    overlay.style.textAlign = 'center';
    overlay.style.whiteSpace = 'pre-wrap';
    overlay.style.pointerEvents = 'none';

    const player = document.querySelector<HTMLElement>('#movie_player') ?? document.body;
    player.append(overlay);
    return overlay;
  }
}

function readNativeFont(): string {
  const segment = document.querySelector<HTMLElement>('.ytp-caption-segment');
  if (!segment) return 'clamp(18px, 3.5vw, 34px)/1.35 system-ui, sans-serif';

  const style = getComputedStyle(segment);
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily}`;
}
