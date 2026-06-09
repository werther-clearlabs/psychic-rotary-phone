#!/bin/bash 

if [[ $# != 1 ]]; then 
    echo "usage: 00-start-monitor.sh logfile"
    exit 2
fi

source ~/venv-glances/bin/activate
glances --export csv --export-csv-file "$1"
