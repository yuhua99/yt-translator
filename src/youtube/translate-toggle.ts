import type { ExtensionSettings } from "../shared/messages";

const BUTTON_ID = "simple-translator-toggle";

function svgMarkup(active: boolean): string {
  const bgFill = active
    ? 'fill="white"'
    : 'fill="none" stroke="white" stroke-width="1.8"';
  const lineStroke = active ? "black" : "white";
  return `<svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="5" width="20" height="16" rx="2" ${bgFill}></rect>
  <line x1="5" y1="13" x2="17" y2="13" stroke="${lineStroke}" stroke-width="1.8" stroke-linecap="round"></line>
  <line x1="5" y1="17" x2="17" y2="17" stroke="${lineStroke}" stroke-width="1.8" stroke-linecap="round"></line>
  <rect x="11" y="0" width="13" height="10" rx="2" fill="#FF0000"></rect>
  <text x="17.5" y="8" font-family="Arial, sans-serif" font-size="8" font-weight="700" fill="white" text-anchor="middle" letter-spacing="0.2">AI</text>
</svg>`;
}

function createToggleButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.className = "ytp-button";
  button.type = "button";
  button.setAttribute("aria-pressed", "false");
  button.title = "Toggle AI Translate";

  const iconWrapper = document.createElement("div");
  iconWrapper.innerHTML = svgMarkup(false);
  button.append(iconWrapper);

  button.addEventListener("click", () => {
    void toggleEnabled();
  });

  return button;
}

function applyActiveStyle(button: HTMLButtonElement, active: boolean): void {
  button.setAttribute("aria-pressed", String(active));
  button.title = active
    ? "AI Translate: ON (click to disable)"
    : "AI Translate: OFF (click to enable)";
  const iconWrapper = button.querySelector("div");
  if (iconWrapper) iconWrapper.innerHTML = svgMarkup(active);
}

function findCcButton(): HTMLButtonElement | null {
  return document.querySelector(".ytp-subtitles-button");
}

function injectButton(): void {
  if (document.getElementById(BUTTON_ID)) return;

  const ccButton = findCcButton();
  if (!ccButton) return;

  const toggle = createToggleButton();
  ccButton.parentElement?.insertBefore(toggle, ccButton);
}

async function toggleEnabled(): Promise<void> {
  const settings = await loadSettings();
  if (!settings) return;
  const next = { ...settings, enabled: !settings.enabled };

  chrome.storage.sync.set({ settings: next });

  const button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (button) applyActiveStyle(button, next.enabled);
}

async function loadSettings(): Promise<ExtensionSettings | null> {
  return new Promise<ExtensionSettings | null>((resolve) => {
    chrome.storage.sync.get("settings", (result) => {
      resolve((result.settings as ExtensionSettings | undefined) ?? null);
    });
  });
}

function updateButtonFromSettings(settings: ExtensionSettings): void {
  const button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (button) applyActiveStyle(button, settings.enabled);
}

function observeCcButton(): void {
  const tryInject = () => injectButton();

  const observer = new MutationObserver(tryInject);
  observer.observe(document.body, { childList: true, subtree: true });

  // Try immediately and after short delays for dynamic player loads
  tryInject();
  window.setTimeout(tryInject, 500);
  window.setTimeout(tryInject, 2_000);
  window.setTimeout(tryInject, 5_000);
}

function listenForSettingsChanges(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.settings) return;
    const next = changes.settings.newValue as ExtensionSettings | undefined;
    if (next) updateButtonFromSettings(next);
  });
}

export function injectTranslateToggle(): void {
  void loadSettings().then((settings) => {
    if (!settings) return;

    observeCcButton();
    listenForSettingsChanges();
    updateButtonFromSettings(settings);
  });
}
