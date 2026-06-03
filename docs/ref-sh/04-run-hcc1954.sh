#!/bin/bash
set -euo pipefail

PARABRICKS_DOCKER_IMG=nvcr.io/nvidia/clara/clara-parabricks:4.7.0-1

# NORMAL bam (tumor might be mislabelled)
REF=/mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta
R1=/mnt/storage/parabricks_test/data/tumor/SRR28305162_1.fastq
R2=/mnt/storage/parabricks_test/data/tumor/SRR28305162_2.fastq

docker run -it -v /mnt/storage:/mnt/storage -w $PWD \
    --user $(id -u):$(id -g) \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    --gpus all \
    ${PARABRICKS_DOCKER_IMG} \
  pbrun fq2bam --ref ${REF} \
    --in-fq ${R1} ${R1} \
    --out-bam hcc1954_normal.bam \
| tee hcc1954_normal.bam.pbrun.log

# TUMOR bam (normal might be mislabelled)
REF=/mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta
R1=/mnt/storage/parabricks_test/data/normal/SRR28305159_1.fastq
R2=/mnt/storage/parabricks_test/data/normal/SRR28305159_2.fastq

docker run -it -v /mnt/storage:/mnt/storage -w $PWD \
    --user $(id -u):$(id -g) \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    --gpus all \
    ${PARABRICKS_DOCKER_IMG} \
  pbrun fq2bam --ref ${REF} \
    --in-fq ${R1} ${R1} \
    --out-bam hcc1954_tumor.bam \
| tee hcc1954_tumor.bam.pbrun.log

NORMAL=hcc1954_normal.bam
TUMOR=hcc1954_tumor.bam

PARABRICKS_DOCKER_IMG=nvcr.io/nvidia/clara/clara-parabricks:4.7.0-1

docker run -it -v /mnt/storage:/mnt/storage -w $PWD \
    --user $(id -u):$(id -g) \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    --gpus all \
    ${PARABRICKS_DOCKER_IMG} \
  pbrun deepsomatic \
    --ref ${REF} \
    --in-tumor-bam ${TUMOR} \
    --in-normal-bam ${NORMAL} \
    --out-variants hcc1943_somatic.vcf
