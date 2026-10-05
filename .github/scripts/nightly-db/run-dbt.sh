#!/usr/bin/env bash
set -euo pipefail

echo "> $(date) - Starting DBT run"
./run_dbt.sh run
echo "> $(date) - DBT run completed successfully"
