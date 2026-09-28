export type InstallPlatform = 'chrome' | 'ios'

export type PwaSnapshot = {
  installed: boolean
  installPlatform: InstallPlatform | null
  installCardDismissed: boolean
  updateAvailable: boolean
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const PWA_EVENT = 'habit-tracker:pwa'
const DISMISS_KEY = 'habit-tracker:install-card-dismissed'

let initialized = false
let deferredPrompt: BeforeInstallPromptEvent | null = null
let registration: ServiceWorkerRegistration | null = null
let updateAvailable = false
let updateRequested = false

function emit(): void {
  window.dispatchEvent(new Event(PWA_EVENT))
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && typeof nav.standalone === 'boolean')
}

function readDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function getPwaSnapshot(): PwaSnapshot {
  const installed = isStandalone()
  const installPlatform: InstallPlatform | null = installed ? null : deferredPrompt ? 'chrome' : isIOS() ? 'ios' : null
  return { installed, installPlatform, installCardDismissed: readDismissed(), updateAvailable }
}

export function subscribePwa(callback: () => void): () => void {
  window.addEventListener(PWA_EVENT, callback)
  return () => window.removeEventListener(PWA_EVENT, callback)
}

export function dismissInstallCard(): void {
  try {
    globalThis.localStorage?.setItem(DISMISS_KEY, '1')
  } catch {
    // Storage may be disabled; the card simply reappears next visit.
  }
  emit()
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  const prompt = deferredPrompt
  deferredPrompt = null
  prompt.prompt()
  const choice = await prompt.userChoice
  emit()
  return choice.outcome
}

export function applyUpdate(): void {
  updateRequested = true
  registration?.waiting?.postMessage('SKIP_WAITING')
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist()
  } catch {
    // Best-effort; a denial or unsupported browser should never block recording.
  }
}

function registerServiceWorker(): void {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    registration = reg
    if (reg.waiting && navigator.serviceWorker.controller) {
      updateAvailable = true
      emit()
    }
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          updateAvailable = true
          emit()
        }
      })
    })
    const recheck = () => { if (document.visibilityState === 'visible') void reg.update() }
    document.addEventListener('visibilitychange', recheck)
    window.addEventListener('focus', recheck)
    window.setInterval(recheck, 5 * 60_000)
  }).catch(() => {
    // No service worker support (or a blocked registration) — the app still works online.
  })

  // controllerchange also fires the first time this page is claimed by a freshly-installed worker
  // (going from no controller to one) — not just on a real update. Reloading unconditionally would
  // reload every first visit, racing whatever the User is already doing. Only reload the reload we
  // ourselves triggered via applyUpdate().
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !updateRequested) return
    reloading = true
    window.location.reload()
  })
}

export function initPwa(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    emit()
  })

  if (!('serviceWorker' in navigator)) return

  // Registering (and its network fetch of /sw.js) is deferred past the load event — the standard
  // pattern to keep it from competing with the page's own critical first-load work, such as an
  // immediate navigation the user triggers (e.g. the sign-in redirect) racing the registration.
  if (document.readyState === 'complete') registerServiceWorker()
  else window.addEventListener('load', registerServiceWorker, { once: true })
}
