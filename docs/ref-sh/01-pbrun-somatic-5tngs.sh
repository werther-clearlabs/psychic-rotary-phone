#!/bin/bash
set -e
PARABRICKS_DOCKER_IMG=nvcr.io/nvidia/clara/clara-parabricks:4.7.0-1
REF="/mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta"
OUTDIR="./results_serial_somatic"
INDIR="/mnt/storage/parabricks_test/data/pillar_test_data/onc089eec2c"
mkdir -p $OUTDIR

SAMPLES=(SIP0001 SIP0002 SIP0003 SIP0004 SIP0005)

echo "=== Serial somatic, tumor-only, panel (1 GPU/sample) run ==="
TOTAL_START=$SECONDS

for SAMPLE in "${SAMPLES[@]}"; do
  echo "--- $SAMPLE start: $(date) ---"
  SAMPLE_START=$SECONDS

  docker run -it -v /mnt/storage:/mnt/storage -w $PWD \
    --user $(id -u):$(id -g) \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    --gpus all \
    ${PARABRICKS_DOCKER_IMG} \
  pbrun somatic \
    --num-gpus 1 \
    --ref "$REF" \
    --in-tumor-fq $(ls ${INDIR}-${SAMPLE}_S*_L001_R1_001.fastq.gz) \
                  $(ls ${INDIR}-${SAMPLE}_S*_L001_R2_001.fastq.gz) \
    --out-tumor-bam "${OUTDIR}/${SAMPLE}.bam" \
    --out-vcf "${OUTDIR}/${SAMPLE}.somatic.vcf" \
    --tmp-dir /tmp

  echo "--- $SAMPLE done: $((SECONDS - SAMPLE_START))s ---"
done

echo "=== Total wall time: $((SECONDS - TOTAL_START))s ==="