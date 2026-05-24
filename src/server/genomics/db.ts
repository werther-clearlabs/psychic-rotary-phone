// src/server/genomics/db.ts
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export function openDb(path: string): Database.Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

const dbPath =
  process.env.GENOMICS_DB_PATH ??
  join(
    process.env.HERMES_HOME ?? join(homedir(), '.hermes'),
    'genomics.db',
  )

export const db = openDb(dbPath)

import { runMigrations } from './schema'
runMigrations(db)
