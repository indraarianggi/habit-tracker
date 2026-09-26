export type DevicePreferences = {
  focusSound: boolean
  breakSound: boolean
  wakeLock: boolean
  theme: 'system' | 'light' | 'dark'
}

export const DEVICE_PREFERENCES_KEY = 'habit-tracker-device-preferences'

const defaults: DevicePreferences = {
  focusSound: true,
  breakSound: true,
  wakeLock: true,
  theme: 'system',
}

export function readDevicePreferences(): DevicePreferences {
  try {
    const raw = globalThis.localStorage?.getItem(DEVICE_PREFERENCES_KEY)
    if (!raw) return { ...defaults }
    const saved: unknown = JSON.parse(raw)
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return { ...defaults }
    return {
      focusSound: 'focusSound' in saved && typeof saved.focusSound === 'boolean' ? saved.focusSound : defaults.focusSound,
      breakSound: 'breakSound' in saved && typeof saved.breakSound === 'boolean' ? saved.breakSound : defaults.breakSound,
      wakeLock: 'wakeLock' in saved && typeof saved.wakeLock === 'boolean' ? saved.wakeLock : defaults.wakeLock,
      theme: 'theme' in saved && (saved.theme === 'system' || saved.theme === 'light' || saved.theme === 'dark')
        ? saved.theme : defaults.theme,
    }
  } catch {
    return { ...defaults }
  }
}

export function saveDevicePreferences(preferences: DevicePreferences): void {
  if (typeof preferences.focusSound !== 'boolean' || typeof preferences.breakSound !== 'boolean' ||
    typeof preferences.wakeLock !== 'boolean' || !['system', 'light', 'dark'].includes(preferences.theme)) {
    throw new Error('Invalid device preferences.')
  }
  try {
    globalThis.localStorage?.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // Storage may be disabled or unavailable (including during server rendering).
  }
}
