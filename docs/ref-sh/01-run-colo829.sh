#!/bin/bash
REF=/mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta
R1=/mnt/storage/parabricks_test/data/normal/SRR28305165_1.fastq
R2=/mnt/storage/parabricks_test/data/normal/SRR28305165_2.fastq

PARABRICKS_DOCKER_IMG=nvcr.io/nvidia/clara/clara-parabricks:4.7.0-1

#docker run -it -v /mnt/storage:/mnt/storage -w $PWD \
#    --user $(id -u):$(id -g) \
#    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
#    --gpus all \
#    ${PARABRICKS_DOCKER_IMG} \
#  pbrun fq2bam --ref ${REF} \
#    --in-fq ${R1} ${R1} \
#    --out-bam colo829_normal.bam \
#| tee colo829_normal.bam.pbrun.log

REF=/mnt/storage/parabricks_test/ref/Homo_sapiens_assembly38.fasta
R1=/mnt/storage/parabricks_test/data/tumor/SRR28305187_1.fastq
R2=/mnt/storage/parabricks_test/data/tumor/SRR28305187_2.fastq

docker run -it -v /mnt/storage:/mnt/storage -w $PWD \
    --user $(id -u):$(id -g) \
    -v /etc/passwd:/etc/passwd:ro -v /etc/group:/etc/group:ro \
    --gpus all \
    ${PARABRICKS_DOCKER_IMG} \
  pbrun fq2bam --ref ${REF} \
    --in-fq ${R1} ${R1} \
    --out-bam colo829_tumor.bam \
| tee colo829_tumor.bam.pbrun.log

NORMAL=colo829_normal.bam
TUMOR=colo829_tumor.bam

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
    --out-variants somatic.vcf
