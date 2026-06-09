#!/bin/bash
set -euo pipefail

PARABRICKS_DOCKER_IMG=nvcr.io/nvidia/clara/clara-parabricks:4.7.0-1
REF=/mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta

# docker wrapper (-i only; -t breaks when piping to tee)
pb() {
  docker run --rm -i -v /mnt/storage:/mnt/storage -w "$PWD" \
    --user "$(id -u):$(id -g)" \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    --gpus all \
    "${PARABRICKS_DOCKER_IMG}" "$@"
}

TOTAL_START=$SECONDS

# --- Normal: fq2bam ---
N_R1=/mnt/storage/parabricks_test/data/normal/SRR28305165_1.fastq
N_R2=/mnt/storage/parabricks_test/data/normal/SRR28305165_2.fastq
pb pbrun fq2bam --ref "$REF" \
  --in-fq "$N_R1" "$N_R2" "@RG\tID:colo829_normal\tLB:lib1\tPL:ILLUMINA\tSM:colo829_normal\tPU:unit1" \
  --num-gpus 2 \
  --out-bam colo829_normal.bam \
  2>&1 | tee colo829_normal.bam.pbrun.log

# --- Tumor: fq2bam ---
T_R1=/mnt/storage/parabricks_test/data/tumor/SRR28305187_1.fastq
T_R2=/mnt/storage/parabricks_test/data/tumor/SRR28305187_2.fastq
pb pbrun fq2bam --ref "$REF" \
  --in-fq "$T_R1" "$T_R2" "@RG\tID:colo829_tumor\tLB:lib1\tPL:ILLUMINA\tSM:colo829_tumor\tPU:unit1" \
  --num-gpus 2 \
  --out-bam colo829_tumor.bam \
  2>&1 | tee colo829_tumor.bam.pbrun.log

# --- DeepSomatic: tumor-normal ---
pb pbrun deepsomatic --ref "$REF" \
  --in-tumor-bam colo829_tumor.bam \
  --in-normal-bam colo829_normal.bam \
  --num-gpus 2 \
  --out-variants somatic.vcf \
  2>&1 | tee somatic.vcf.pbrun.log

echo "=== Total wall time: $((SECONDS - TOTAL_START))s ==="