import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { migrateAuth } from './auth-schema'
const baseURL = process.env.BETTER_AUTH_URL
const secret = process.env.BETTER_AUTH_SECRET
const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET

if (!baseURL || !/^https?:\/\/[^/]+$/.test(baseURL)) {
  throw new Error('Set BETTER_AUTH_URL to the public app origin (no trailing slash).')
}
if (!secret || secret.length < 32 || !clientId || !clientSecret) {
  throw new Error('Set BETTER_AUTH_SECRET (32+ characters), GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.')
}

const databasePath = resolve(process.env.DATABASE_PATH || '.data/habit-tracker.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })
const database = new Database(databasePath)
database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')

migrateAuth(database)
export const authOptions = {
  baseURL,
  secret,
  database,
  socialProviders: { google: { clientId, clientSecret } },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  plugins: [tanstackStartCookies()],
}

export const auth = betterAuth(authOptions)
