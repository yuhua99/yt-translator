export type ProgressState = 'running' | 'success' | 'error';

export interface TranslationProgressInput {
  id: string;
  label: string;
  total: number;
}

export interface TranslationProgressUpdate {
  id: string;
  completed: number;
  total: number;
  message?: string;
}

export interface TranslationProgressMessage {
  id: string;
  message?: string;
}

export interface TranslationProgressError {
  id: string;
  message: string;
}

export interface TranslationProgressHud {
  start(input: TranslationProgressInput): void;
  update(input: TranslationProgressUpdate): void;
  success(input: TranslationProgressMessage): void;
  error(input: TranslationProgressError): void;
  clear(id: string): void;
  clearAll(): void;
}

interface HudItem {
  element: HTMLElement;
  title: HTMLElement;
  message: HTMLElement;
  timeout?: ReturnType<typeof setTimeout>;
}

const HUD_ID = 'simple-translator-progress-hud';
const ITEM_ATTR = 'data-simple-translator-progress-id';

export function formatProgressMessage(completed: number, total: number): string {
  return `翻譯中 ${completed}/${total}`;
}

export function formatSuccessMessage(completed: number, total: number): string {
  return `完成 ${completed}/${total}`;
}

export function createTranslationProgressHud(): TranslationProgressHud {
  return new DomTranslationProgressHud();
}

class DomTranslationProgressHud implements TranslationProgressHud {
  private readonly items = new Map<string, HudItem>();

  start(input: TranslationProgressInput): void {
    const item = this.ensureItem(input.id, input.label);
    item.title.textContent = input.label;
    this.renderItem(item, 'running', `開始翻譯… 0/${input.total}`);
  }

  update(input: TranslationProgressUpdate): void {
    const item = this.items.get(input.id) ?? this.ensureItem(input.id, '字幕翻譯');
    this.renderItem(item, 'running', input.message ?? formatProgressMessage(input.completed, input.total));
  }

  success(input: TranslationProgressMessage): void {
    const item = this.items.get(input.id) ?? this.ensureItem(input.id, '字幕翻譯');
    this.renderItem(item, 'success', input.message ?? '完成');
    this.scheduleClear(input.id, 4000);
  }

  error(input: TranslationProgressError): void {
    const item = this.items.get(input.id) ?? this.ensureItem(input.id, '字幕翻譯');
    this.renderItem(item, 'error', input.message);
    this.scheduleClear(input.id, 10_000);
  }

  clear(id: string): void {
    const item = this.items.get(id);

    if (!item) {
      return;
    }

    if (item.timeout) {
      clearTimeout(item.timeout);
    }

    item.element.remove();
    this.items.delete(id);

    if (this.items.size === 0) {
      document.getElementById(HUD_ID)?.remove();
    }
  }

  clearAll(): void {
    for (const id of this.items.keys()) {
      this.clear(id);
    }
  }

  private ensureItem(id: string, label: string): HudItem {
    const existing = this.items.get(id);

    if (existing) {
      if (existing.timeout) {
        clearTimeout(existing.timeout);
        existing.timeout = undefined;
      }
      return existing;
    }

    const container = this.ensureContainer();
    const element = document.createElement('div');
    const title = document.createElement('div');
    const message = document.createElement('div');
    const icon = document.createElement('span');
    const text = document.createElement('div');

    element.setAttribute(ITEM_ATTR, id);
    element.style.display = 'grid';
    element.style.gridTemplateColumns = '16px 1fr';
    element.style.gap = '8px';
    element.style.alignItems = 'start';
    element.style.minWidth = '220px';
    element.style.maxWidth = '360px';
    element.style.padding = '10px 12px';
    element.style.border = '1px solid rgba(255, 255, 255, 0.12)';
    element.style.borderRadius = '10px';
    element.style.background = 'rgba(20, 20, 24, 0.92)';
    element.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.35)';
    element.style.backdropFilter = 'blur(8px)';
    element.style.color = 'white';
    element.style.font = '12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    element.style.pointerEvents = 'none';

    icon.textContent = '●';
    icon.style.marginTop = '1px';
    icon.style.fontSize = '12px';

    title.textContent = label;
    title.style.fontWeight = '600';
    title.style.marginBottom = '2px';

    message.style.color = 'rgba(255, 255, 255, 0.74)';
    message.style.whiteSpace = 'nowrap';
    message.style.overflow = 'hidden';
    message.style.textOverflow = 'ellipsis';

    text.append(title, message);
    element.append(icon, text);
    container.append(element);

    const item = { element, title, message };
    this.items.set(id, item);
    return item;
  }

  private ensureContainer(): HTMLElement {
    const existing = document.getElementById(HUD_ID);

    if (existing) {
      return existing;
    }

    const container = document.createElement('div');
    container.id = HUD_ID;
    container.style.position = 'fixed';
    container.style.right = '24px';
    container.style.bottom = '96px';
    container.style.zIndex = '2147483647';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.pointerEvents = 'none';
    document.documentElement.append(container);
    return container;
  }

  private renderItem(item: HudItem, state: ProgressState, message: string): void {
    const icon = item.element.querySelector('span');

    if (icon) {
      icon.style.color = stateColor(state);
      icon.style.animation = state === 'running' ? 'simple-translator-pulse 1.2s ease-in-out infinite' : '';
    }

    item.element.style.borderColor = state === 'error' ? 'rgba(255, 95, 86, 0.55)' : 'rgba(255, 255, 255, 0.12)';
    item.message.textContent = message;
    ensurePulseStyle();
  }

  private scheduleClear(id: string, delayMs: number): void {
    const item = this.items.get(id);

    if (!item) {
      return;
    }

    if (item.timeout) {
      clearTimeout(item.timeout);
    }

    item.timeout = setTimeout(() => this.clear(id), delayMs);
  }
}

function stateColor(state: ProgressState): string {
  if (state === 'success') {
    return '#5ee787';
  }

  if (state === 'error') {
    return '#ff5f56';
  }

  return '#58a6ff';
}

function ensurePulseStyle(): void {
  if (document.getElementById('simple-translator-progress-style')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'simple-translator-progress-style';
  style.textContent = `
    @keyframes simple-translator-pulse {
      0%, 100% { opacity: 0.35; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.05); }
    }
  `;
  document.head.append(style);
}
