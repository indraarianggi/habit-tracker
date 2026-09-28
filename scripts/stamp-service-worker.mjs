// Appends a unique build marker to the deployed service worker so its bytes differ
// from the previous release. The browser's update check compares sw.js byte-for-byte;
// without a change here, a new deploy would never enter the install/waiting lifecycle
// that drives the "New version available" banner.
import { appendFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const target = ['.output/public/sw.js', 'dist/client/sw.js'].find(existsSync)
if (!target) {
  console.error('stamp-service-worker: no built sw.js found (looked in .output/public and dist/client).')
  process.exit(1)
}

appendFileSync(target, `\n// build ${new Date().toISOString()} ${randomUUID()}\n`)
console.log(`stamp-service-worker: stamped ${target}`)
