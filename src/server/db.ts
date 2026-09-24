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

const sessionSchema = `
create table active_session (
  userId text not null primary key references "user" ("id") on delete cascade,
  id text not null unique,
  taskId text not null references task (id) on delete cascade,
  day text not null,
  plannedMinutes integer not null check (plannedMinutes = 25),
  status text not null check (status in ('running', 'paused')),
  startedAt text not null,
  elapsedMs integer not null check (elapsedMs >= 0),
  segmentStartedAt text,
  lastControlAt text not null,
  check ((status = 'running' and segmentStartedAt is not null)
    or (status = 'paused' and segmentStartedAt is null))
);
create table session_receipt (
  sessionId text not null primary key,
  userId text not null references "user" ("id") on delete cascade,
  outcome text not null check (outcome in ('saved', 'discarded')),
  checkinId text,
  check ((outcome = 'saved' and checkinId is not null)
    or (outcome = 'discarded' and checkinId is null))
);
create index session_receipt_user_idx on session_receipt (userId);
create table session_checkin (
  id text not null primary key,
  userId text not null references "user" ("id") on delete cascade,
  taskId text not null,
  durationMinutes integer not null check (durationMinutes > 0),
  origin text not null check (origin = 'session'),
  sourceSessionId text not null unique references session_receipt (sessionId) on delete cascade,
  createdAt text not null
);
create index session_checkin_user_idx on session_checkin (userId, createdAt, id);
create table session_last_task (
  userId text not null primary key references "user" ("id") on delete cascade,
  taskId text not null
);
`

const checkinSchemaV4 = `
create table session_checkin_v4 (
  id text not null primary key,
  userId text not null references "user" ("id") on delete cascade,
  taskId text not null references task (id) on delete cascade,
  durationMinutes integer not null check (durationMinutes between 1 and 480),
  origin text not null check (origin in ('session', 'manual')),
  sourceSessionId text unique references session_receipt (sessionId),
  createdAt text not null,
  check ((origin = 'session' and sourceSessionId is not null)
    or (origin = 'manual' and sourceSessionId is null))
);
insert into session_checkin_v4
  (id, userId, taskId, durationMinutes, origin, sourceSessionId, createdAt)
  select id, userId, taskId, durationMinutes, origin, sourceSessionId, createdAt
  from session_checkin;
drop table session_checkin;
alter table session_checkin_v4 rename to session_checkin;
create index session_checkin_user_idx on session_checkin (userId, createdAt, id);
create table checkin_change_receipt (
  userId text not null references "user" ("id") on delete cascade,
  id text not null,
  request text not null,
  checkinId text not null,
  primary key (userId, id)
);
create table checkin_deletion (
  checkinId text not null primary key,
  userId text not null references "user" ("id") on delete cascade
);
`

const databasePath = resolve(process.env.DATABASE_PATH || '.data/habit-tracker.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })
export const database = new Database(databasePath)
database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')

const version = database.pragma('user_version', { simple: true }) as number
if (version > 4) throw new Error(`Unsupported SQLite schema version ${version}`)

if (version < 4) {
  database.transaction(() => {
    if (version < 1) {
      database.exec(authSchema)
      database.pragma('user_version = 1')
    }
    if (version < 2) {
      database.exec(taskSchema)
      database.pragma('user_version = 2')
    }
    if (version < 3) {
      database.exec(sessionSchema)
      database.pragma('user_version = 3')
    }
    database.exec(checkinSchemaV4)
    database.pragma('user_version = 4')
  })()
}
