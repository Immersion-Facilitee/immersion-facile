#!/usr/bin/env bash
set -euo pipefail

dbclient-fetcher pgsql 17
echo "> $(date -u) - Starting VACUUM ANALYZE"
/app/bin/psql "$SCALINGO_POSTGRESQL_URL" -v ON_ERROR_STOP=1 -c "VACUUM (ANALYZE);"
echo "> $(date -u) - VACUUM ANALYZE completed successfully"
