// src/server/genomics/types.ts
export type CaseStatus = 'active' | 'closed' | 'pending'
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed'
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ReportStatus = 'draft' | 'signed'

export interface BatchSomaticTumorConfig {
  mode: 'batch-somatic-tumor'
  input_dir: string
  samples: string[]
  num_gpus_per_sample: number
}

export interface BatchGermlineConfig {
  mode: 'batch-germline'
  input_dir: string
  samples: string[]
  num_gpus_per_sample: number
}

export interface PairedSomaticConfig {
  mode: 'paired-somatic'
  normal: { sample_id: string; r1: string; r2: string }
  tumor:  { sample_id: string; r1: string; r2: string }
}

export type RunConfig = BatchSomaticTumorConfig | BatchGermlineConfig | PairedSomaticConfig

export interface Case {
  id: string
  patient_id: string | null
  patient_name: string | null
  dob: string | null
  diagnosis: string | null
  stage: string | null
  assay_type: string | null      // e.g. 'WGS' | 'targeted-panel' | 'RNA-seq' — used by GenerateReportModal to filter protocols
  status: CaseStatus
  report_status: ReportStatus | null
  ehr_summary: string | null
  created_at: number
  updated_at: number
}

export interface CaseSample {
  id: string
  case_id: string
  sample_id: string | null
  sample_type: 'tumor' | 'normal' | 'germline' | null
  fastq_path: string | null
  vcf_path: string | null
  added_at: number
}

export interface Run {
  id: string
  name: string
  pipeline: string
  reference: string | null
  // Legacy flat fields (kept for backwards compat)
  fastq_path: string | null
  output_path: string | null
  // Structured config
  run_config: string | null     // JSON-encoded RunConfig
  output_dir: string | null
  log_dir: string | null
  num_gpus: number
  case_id: string | null
  status: RunStatus
  pbrun_command: string | null  // generated command stored for audit
  created_at: number
  updated_at: number
}

export interface RunStage {
  id: string
  run_id: string
  name: string
  status: StageStatus
  started_at: number | null
  finished_at: number | null
  log_tail: string | null
  log_file_path: string | null
}

export interface Protocol {
  id: string
  name: string
  version: string
  assay_type: string
  description: string | null
  prompt_template: string
  skills: string[]
  variables: ProtocolVariable[]
  is_active: number
  created_at: number
  updated_at: number
}

export interface ProtocolVariable {
  name: string
  label: string
  source: string   // 'case.vcf_path' | 'case.diagnosis' | 'manual' | etc.
  editable: boolean
}

export interface Report {
  id: string
  case_id: string
  protocol_id: string | null
  protocol_version: string | null
  version: number
  status: ReportStatus
  sections: Record<string, string>   // { "1": "...", "2": "..." }
  figures: ReportFigure[]
  source_path: string | null
  signed_by: string | null
  signed_at: number | null
  created_at: number
  updated_at: number
}

export interface ReportFigure {
  section: string
  path: string
  caption: string
}
