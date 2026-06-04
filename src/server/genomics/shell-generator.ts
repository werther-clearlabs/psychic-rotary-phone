import type { Run } from './types'
import { getRunConfig } from './runs-store'

const PARABRICKS_IMG = 'nvcr.io/nvidia/clara/clara-parabricks:4.7.0-1'

export const REFERENCE_PATHS: Record<string, string> = {
  GRCh38: '/mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta',
  hg19:   '/mnt/storage/parabricks_test/ref/ucsc.hg19.fasta',
}

export function generateShellScript(run: Run, ingestUrl: string, apiToken: string): string {
  const config = getRunConfig(run)
  if (!config) throw new Error(`run ${run.id} has no run_config`)
  if (config.mode !== 'batch-somatic-tumor') {
    throw new Error(`shell generation not supported for pipeline mode: ${config.mode}`)
  }

  const ref = REFERENCE_PATHS[run.reference ?? ''] ?? run.reference ?? ''
  const logDir = run.log_dir ?? run.output_dir ?? '/tmp'
  const outDir = run.output_dir ?? '/tmp/pbrun-out'
  const samplesArr = config.samples.map((s) => `"${s}"`).join(' ')
  const numGpus = String(config.num_gpus_per_sample)
  const inDir = config.input_dir

  // Produce a curl call that POSTs a static JSON payload.
  // All values are baked in at generation time; no bash variable expansion needed in payload.
  const curlStatic = (payload: object) =>
    `curl -sf -X POST '${ingestUrl}' ` +
    `-H 'Authorization: Bearer ${apiToken}' ` +
    `-H 'Content-Type: application/json' ` +
    `-d '${JSON.stringify(payload)}' || true`

  // For payloads that need $SAMPLE expanded at runtime, build the JSON with bash variable
  // interpolation using printf to avoid quoting issues.
  const curlSample = (event: string, extra = '') =>
    `printf '{"event":"${event}","stage":"%s"${extra}}' "$SAMPLE" | ` +
    `curl -sf -X POST '${ingestUrl}' ` +
    `-H 'Authorization: Bearer ${apiToken}' ` +
    `-H 'Content-Type: application/json' ` +
    `--data-binary @- || true`

  const lines = [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    `PARABRICKS_IMG='${PARABRICKS_IMG}'`,
    `REF='${ref}'`,
    `INDIR='${inDir}'`,
    `OUTDIR='${outDir}'`,
    `LOGDIR='${logDir}'`,
    `NUM_GPUS='${numGpus}'`,
    `SAMPLES=(${samplesArr})`,
    '',
    'mkdir -p "$OUTDIR" "$LOGDIR"',
    '',
    'TOTAL_START=$SECONDS',
    '',
    'for SAMPLE in "${SAMPLES[@]}"; do',
    '  SAMPLE_START=$SECONDS',
    `  ${curlSample('stage_start')}`,
    '',
    '  docker run --rm -i \\',
    '    -v /mnt/storage:/mnt/storage -w "$PWD" \\',
    '    --user "$(id -u):$(id -g)" \\',
    '    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \\',
    '    --gpus all \\',
    '    "$PARABRICKS_IMG" \\',
    '  pbrun somatic \\',
    '    --num-gpus "$NUM_GPUS" \\',
    '    --ref "$REF" \\',
    '    --in-tumor-fq \\',
    '      "$(ls ${INDIR}-${SAMPLE}_S*_L001_R1_001.fastq.gz)" \\',
    '      "$(ls ${INDIR}-${SAMPLE}_S*_L001_R2_001.fastq.gz)" \\',
    '    --out-tumor-bam "${OUTDIR}/${SAMPLE}.bam" \\',
    '    --out-vcf "${OUTDIR}/${SAMPLE}.somatic.vcf" \\',
    '    --tmp-dir /tmp \\',
    '    2>&1 | tee "${LOGDIR}/${SAMPLE}.log"',
    '',
    '  PBRUN_EXIT=${PIPESTATUS[0]}',
    '  if [ "$PBRUN_EXIT" -ne 0 ]; then',
    `    ${curlSample('stage_failed', ',"exit_code":1')}`,
    `    ${curlStatic({ event: 'run_failed' })}`,
    '    exit "$PBRUN_EXIT"',
    '  fi',
    '',
    `  ${curlSample('stage_complete', ',"exit_code":0')}`,
    '  echo "--- $SAMPLE done: $((SECONDS - SAMPLE_START))s ---"',
    'done',
    '',
    `${curlStatic({ event: 'run_complete' })}`,
    'echo "=== Total wall time: $((SECONDS - TOTAL_START))s ==="',
  ]

  return lines.join('\n') + '\n'
}
