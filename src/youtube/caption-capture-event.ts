export const CAPTION_EVENT = 'shinkansen-yt-captions';

export interface CaptionsCapturedEventDetail {
  url: string;
  responseText: string;
}

export function isTimedTextUrl(url: string): boolean {
  return url.includes('/api/timedtext');
}
