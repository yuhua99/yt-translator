import { normalizeCaptionText } from './caption-parser';
import type { TranslatedCue } from './caption-types';

const ORIGINAL_TEXT_ATTR = 'data-simple-translator-source-text';

export function findTranslatedCue(cues: readonly TranslatedCue[], currentTimeMs: number, visibleText: string): TranslatedCue | undefined {
  const normalizedVisibleText = normalizeCaptionText(visibleText);

  return cues.find((cue) => (
    currentTimeMs >= cue.startMs
    && currentTimeMs <= cue.endMs
    && normalizeCaptionText(cue.sourceText) === normalizedVisibleText
  ));
}

export class ManualSubtitleRenderer {
  render(cues: readonly TranslatedCue[], currentTimeMs: number): void {
    for (const segmentElement of document.querySelectorAll<HTMLElement>('.ytp-caption-segment')) {
      this.renderSegment(segmentElement, cues, currentTimeMs);
    }
  }

  clear(): void {
    for (const segmentElement of document.querySelectorAll<HTMLElement>(`.ytp-caption-segment[${ORIGINAL_TEXT_ATTR}]`)) {
      const originalText = segmentElement.getAttribute(ORIGINAL_TEXT_ATTR);

      if (originalText !== null) {
        segmentElement.textContent = originalText;
      }

      segmentElement.removeAttribute(ORIGINAL_TEXT_ATTR);
    }
  }

  private renderSegment(segmentElement: HTMLElement, cues: readonly TranslatedCue[], currentTimeMs: number): void {
    const sourceText = segmentElement.getAttribute(ORIGINAL_TEXT_ATTR) ?? segmentElement.textContent ?? '';
    const cue = findTranslatedCue(cues, currentTimeMs, sourceText);

    if (!cue) {
      this.restoreSegment(segmentElement);
      return;
    }

    if (!segmentElement.hasAttribute(ORIGINAL_TEXT_ATTR)) {
      segmentElement.setAttribute(ORIGINAL_TEXT_ATTR, sourceText);
    }

    segmentElement.textContent = cue.translatedText;
  }

  private restoreSegment(segmentElement: HTMLElement): void {
    const originalText = segmentElement.getAttribute(ORIGINAL_TEXT_ATTR);

    if (originalText === null) {
      return;
    }

    segmentElement.textContent = originalText;
    segmentElement.removeAttribute(ORIGINAL_TEXT_ATTR);
  }
}
