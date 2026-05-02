import { CAPTION_EVENT, isTimedTextUrl, type CaptionsCapturedEventDetail } from './caption-capture-event';

declare global {
  interface Window {
    __simpleTranslatorCaptionCaptureInstalled?: boolean;
  }
}

if (!window.__simpleTranslatorCaptionCaptureInstalled) {
  window.__simpleTranslatorCaptionCaptureInstalled = true;
  installXhrCapture();
  installFetchCapture();
}

function dispatchCaptionCapture(detail: CaptionsCapturedEventDetail): void {
  window.dispatchEvent(new CustomEvent<CaptionsCapturedEventDetail>(CAPTION_EVENT, { detail }));
}

function installXhrCapture(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  function patchedOpen(this: XMLHttpRequest, method: string, url: string | URL): void;
  function patchedOpen(this: XMLHttpRequest, method: string, url: string | URL, async: boolean, username?: string | null, password?: string | null): void;
  function patchedOpen(this: XMLHttpRequest, method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null): void {
    this.__simpleTranslatorCaptionUrl = String(url);

    if (async === undefined) {
      Reflect.apply(originalOpen, this, [method, url]);
      return;
    }

    Reflect.apply(originalOpen, this, [method, url, async, username, password]);
  }

  XMLHttpRequest.prototype.open = patchedOpen;

  XMLHttpRequest.prototype.send = function patchedSend(...args: Parameters<XMLHttpRequest['send']>): void {
    const url = this.__simpleTranslatorCaptionUrl;

    if (url && isTimedTextUrl(url)) {
      this.addEventListener('load', () => {
        if (typeof this.responseText === 'string') {
          dispatchCaptionCapture({ url, responseText: this.responseText });
        }
      });
    }

    originalSend.apply(this, args);
  };
}

function installFetchCapture(): void {
  const originalFetch = window.fetch;

  async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await originalFetch(input, init);
    const url = getFetchUrl(input);

    if (!isTimedTextUrl(url)) {
      return response;
    }

    void response.clone().text().then((responseText) => {
      dispatchCaptionCapture({ url, responseText });
    });

    return response;
  }

  window.fetch = Object.assign(patchedFetch, originalFetch);
}

function getFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

declare global {
  interface XMLHttpRequest {
    __simpleTranslatorCaptionUrl?: string;
  }
}
