// src/server/genomics/schema.ts
import type Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      patient_name TEXT,
      dob TEXT,
      diagnosis TEXT,
      stage TEXT,
      assay_type TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      ehr_summary TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS case_samples (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      sample_id TEXT,
      sample_type TEXT,
      fastq_path TEXT,
      vcf_path TEXT,
      added_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pipeline TEXT NOT NULL,
      reference TEXT,
      fastq_path TEXT,
      output_path TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      pbrun_command TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_stages (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at INTEGER,
      finished_at INTEGER,
      log_tail TEXT
    );

    CREATE TABLE IF NOT EXISTS case_runs (
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      PRIMARY KEY (case_id, run_id)
    );

    CREATE TABLE IF NOT EXISTS protocols (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      assay_type TEXT NOT NULL,
      description TEXT,
      prompt_template TEXT NOT NULL,
      skills TEXT NOT NULL DEFAULT '[]',
      variables TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      protocol_id TEXT REFERENCES protocols(id),
      protocol_version TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      sections TEXT NOT NULL DEFAULT '{}',
      figures TEXT NOT NULL DEFAULT '[]',
      source_path TEXT,
      signed_by TEXT,
      signed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}
