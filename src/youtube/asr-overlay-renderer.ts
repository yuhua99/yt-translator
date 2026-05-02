import type { TranslatedCue } from './caption-types';

const OVERLAY_ID = 'simple-translator-asr-overlay';

export function findActiveCue(cues: readonly TranslatedCue[], currentTimeMs: number): TranslatedCue | undefined {
  return cues.find((cue) => currentTimeMs >= cue.startMs && currentTimeMs <= cue.endMs);
}

export class AsrOverlayRenderer {
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

    if (existing) {
      return existing;
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.position = 'absolute';
    overlay.style.left = '50%';
    overlay.style.bottom = '12%';
    overlay.style.transform = 'translateX(-50%)';
    overlay.style.zIndex = '60';
    overlay.style.maxWidth = '80%';
    overlay.style.padding = '4px 8px';
    overlay.style.borderRadius = '4px';
    overlay.style.color = 'white';
    overlay.style.background = 'rgba(0, 0, 0, 0.75)';
    overlay.style.font = '24px/1.35 system-ui, sans-serif';
    overlay.style.textAlign = 'center';
    overlay.style.pointerEvents = 'none';

    const player = document.querySelector<HTMLElement>('#movie_player') ?? document.body;
    player.append(overlay);
    return overlay;
  }
}
