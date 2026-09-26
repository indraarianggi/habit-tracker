import { expect, test } from '@playwright/test'
import { DEVICE_PREFERENCES_KEY, readDevicePreferences, saveDevicePreferences } from '@/lib/device-preferences'

const defaults = { focusSound: true, breakSound: true, wakeLock: true, theme: 'system' as const }

test('device preferences persist only in this device storage and never in duration sync', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const first = new Map<string, string>()
  const second = new Map<string, string>()
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => first.get(key) ?? null,
      setItem: (key: string, value: string) => { first.set(key, value) },
    } })
    expect(readDevicePreferences()).toEqual(defaults)
    const changed = { focusSound: false, breakSound: false, wakeLock: false, theme: 'dark' as const }
    saveDevicePreferences(changed)
    expect(readDevicePreferences()).toEqual(changed)
    expect(JSON.parse(first.get(DEVICE_PREFERENCES_KEY)!)).toEqual(changed)
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => second.get(key) ?? null,
      setItem: (key: string, value: string) => { second.set(key, value) },
    } })
    expect(readDevicePreferences()).toEqual(defaults)
    expect(second.size).toBe(0)
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('corrupt or inaccessible device storage falls back safely without changing stored data', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let stored = '{invalid json'
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: () => stored,
      setItem: (_key: string, value: string) => { stored = value },
    } })
    expect(readDevicePreferences()).toEqual(defaults)
    stored = JSON.stringify({ focusSound: false, breakSound: 'no', wakeLock: false, theme: 'purple' })
    expect(readDevicePreferences()).toEqual({ ...defaults, focusSound: false, wakeLock: false })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('denied') } })
    expect(readDevicePreferences()).toEqual(defaults)
    expect(() => saveDevicePreferences(defaults)).not.toThrow()
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
