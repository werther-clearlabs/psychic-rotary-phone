#!/bin/bash

REF=/mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta
NORMAL=colo829_normal.bam
TUMOR=colo829_tumor_reheader.bam

samtools view -H colo829_tumor.bam | sed s/SM:sample/SM:tumor/ | samtools reheader - colo829_tumor.bam > colo829_tumor_reheader.bam
docker run -it -v /mnt/storage:/mnt/storage -w $PWD \
    --user $(id -u):$(id -g) \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    --gpus all \
    ${PARABRICKS_DOCKER_IMG} \
  pbrun deepsomatic \
    --ref ${REF} \
    --in-tumor-bam ${TUMOR} \
    --in-normal-bam ${NORMAL} \
    --out-variants somatic.vcf
