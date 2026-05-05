import type {
  ExtensionMessage,
  ExtensionResponse,
  ExtensionSettings,
  SettingsResponse,
} from '../shared/messages'

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Popup DOM missing required element: ${selector}`)
  return element
}

const enabledInput = requiredElement<HTMLInputElement>('#enabled')
const settingsButton = requiredElement<HTMLButtonElement>('#settings')
const status = requiredElement<HTMLParagraphElement>('#status')
let currentSettings: ExtensionSettings | undefined

function sendMessage<TResponse extends ExtensionResponse>(
  message: ExtensionMessage,
): Promise<TResponse> {
  return chrome.runtime.sendMessage(message)
}

async function loadSettings(): Promise<void> {
  const response = await sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' })
  if (!response.ok) {
    status.textContent = response.error
    return
  }

  currentSettings = response.settings
  enabledInput.checked = response.settings.enabled
  status.textContent = response.settings.enabled ? 'Enabled' : 'Disabled'
}

async function saveEnabled(enabled: boolean): Promise<void> {
  if (!currentSettings) return

  enabledInput.disabled = true
  const settings = { ...currentSettings, enabled }
  const response = await sendMessage<SettingsResponse>({ type: 'SET_SETTINGS', settings })

  enabledInput.disabled = false
  if (!response.ok) {
    enabledInput.checked = currentSettings.enabled
    status.textContent = response.error
    return
  }

  currentSettings = response.settings
  status.textContent = enabled ? 'Enabled' : 'Disabled'
}

enabledInput.addEventListener('change', () => {
  void saveEnabled(enabledInput.checked)
})

settingsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

void loadSettings()
