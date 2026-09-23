import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'

import { authSchema } from '@/server/auth-schema'

const taskSchema = `
create table task (
  id text not null primary key,
  userId text not null references "user" ("id") on delete cascade,
  day text not null,
  title text not null,
  completed integer not null check (completed in (0, 1)),
  orderKey text not null,
  createdAt text not null,
  updatedAt text not null,
  seq integer not null
);
create index task_user_day_idx on task (userId, day, orderKey, id);
create table task_change (
  seq integer primary key autoincrement,
  id text not null unique,
  userId text not null references "user" ("id") on delete cascade,
  taskId text not null,
  day text not null,
  title text not null,
  completed integer not null check (completed in (0, 1)),
  orderKey text not null,
  createdAt text not null,
  acceptedAt text not null
);
create index task_change_user_seq_idx on task_change (userId, seq);
`

const databasePath = resolve(process.env.DATABASE_PATH || '.data/habit-tracker.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })
export const database = new Database(databasePath)
database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')

const version = database.pragma('user_version', { simple: true }) as number
if (version > 2) throw new Error(`Unsupported SQLite schema version ${version}`)

if (version < 2) {
  database.transaction(() => {
    if (version < 1) {
      database.exec(authSchema)
      database.pragma('user_version = 1')
    }
    database.exec(taskSchema)
    database.pragma('user_version = 2')
  })()
}
