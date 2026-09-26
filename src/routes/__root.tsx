import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import appStyles from '@/styles.css?url'
import { DEVICE_PREFERENCES_KEY, readDevicePreferences } from '@/lib/device-preferences'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Habit Tracker' },
      { name: 'theme-color', content: '#f8f6f1' },
    ],
    links: [{ rel: 'stylesheet', href: appStyles }],
  }),
  component: AppDocument,
})

function AppDocument() {
  return (
    <Document>
      <Outlet />
    </Document>
  )
}

function Document({ children }: { children: ReactNode }) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const theme = readDevicePreferences().theme
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141b1b' : '#f8f6f1')
    }
    const onStorage = (event: StorageEvent) => { if (event.key === DEVICE_PREFERENCES_KEY) apply() }
    media.addEventListener('change', apply)
    window.addEventListener('storage', onStorage)
    window.addEventListener('habit-tracker:device-preferences', apply)
    apply()
    return () => {
      media.removeEventListener('change', apply)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('habit-tracker:device-preferences', apply)
    }
  }, [])
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
