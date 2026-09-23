import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const { VITE_PRIVACY_CONTACT_EMAIL: contact } = loadEnv(mode, process.cwd(), 'VITE_')
  if (!contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || contact.endsWith('@example.com')) {
    throw new Error('Set VITE_PRIVACY_CONTACT_EMAIL to a working contact address before running or building.')
  }

  return {
    server: { port: 3000, strictPort: true },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [
      tanstackStart({ spa: { enabled: true }, router: { routeFileIgnorePattern: '__tests__' } }),
      nitro(),
      react(),
      tailwindcss(),
    ],
  }
})
