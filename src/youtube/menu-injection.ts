const ITEM_ID = 'simple-translator-ai-menu-item';

export interface AiMenuInjection {
  stop(): void;
}

export function injectAiTranslateMenu(onActivate: () => void): AiMenuInjection {
  const observer = new MutationObserver(() => {
    maybeInject(onActivate);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  maybeInject(onActivate);

  return {
    stop() {
      observer.disconnect();
      document.getElementById(ITEM_ID)?.remove();
    },
  };
}

function maybeInject(onActivate: () => void): void {
  if (document.getElementById(ITEM_ID)) return;

  const menu = findOpenYoutubeMenu();
  if (!menu) return;

  const template = menu.querySelector<HTMLElement>('.ytp-menuitem');
  if (!template) return;

  const item = template.cloneNode(true) as HTMLElement;
  item.id = ITEM_ID;
  item.setAttribute('role', 'menuitemradio');
  item.setAttribute('aria-checked', 'false');

  const label = item.querySelector<HTMLElement>('.ytp-menuitem-label');
  if (label) label.textContent = 'AI Translate';
  else item.textContent = 'AI Translate';

  item.querySelector<HTMLElement>('.ytp-menuitem-content')?.replaceChildren();
  item.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  }, true);

  menu.append(item);
}

function findOpenYoutubeMenu(): HTMLElement | undefined {
  const panels = [...document.querySelectorAll<HTMLElement>('.ytp-panel-menu')];
  return panels.find((panel) => panel.offsetParent !== null && looksLikeSubtitleMenu(panel));
}

function looksLikeSubtitleMenu(panel: HTMLElement): boolean {
  const text = panel.textContent ?? '';
  return /auto-generated|自動產生|字幕|Subtitles|captions|English|日本語|中文/i.test(text);
}
