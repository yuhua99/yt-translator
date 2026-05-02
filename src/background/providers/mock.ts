import type { AiProvider, AsrTranslateInput, AsrTranslateOutput, ManualTranslateInput, ManualTranslateOutput } from './types';

export class MockProvider implements AiProvider {
  async translateManual(input: ManualTranslateInput): Promise<ManualTranslateOutput> {
    return {
      translations: input.items.map((item) => ({
        id: item.id,
        text: `[${input.targetLanguage}] ${item.text}`,
      })),
    };
  }

  async translateAsr(input: AsrTranslateInput): Promise<AsrTranslateOutput> {
    return {
      cues: input.segments.map((segment, index) => ({
        startMs: segment.startMs,
        endMs: input.segments[index + 1]?.startMs ?? segment.startMs + 2_000,
        text: `[${input.targetLanguage}] ${segment.text}`,
        sourceSegmentIds: [segment.id],
      })),
    };
  }
}
