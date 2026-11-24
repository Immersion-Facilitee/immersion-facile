#!/usr/bin/env bash
set -euo pipefail

echo "> $(date) - Starting DBT run"
dbt_exit_code=0
./run_dbt.sh run || dbt_exit_code=$?

echo "> $(date) - DBT statement timings"
grep -e "Began running node" -e "SQL status" -e "Finished running node" logs/dbt.log || true

if [ "$dbt_exit_code" -ne 0 ]; then
  echo "> $(date) - DBT run failed with exit code $dbt_exit_code"
  exit "$dbt_exit_code"
fi

echo "> $(date) - DBT run completed successfully"
