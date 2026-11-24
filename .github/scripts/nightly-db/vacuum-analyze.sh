#!/usr/bin/env bash
set -euo pipefail

dbclient-fetcher pgsql 17
echo "> $(date -u) - Starting VACUUM ANALYZE on public_analytics"
/app/bin/psql "$SCALINGO_POSTGRESQL_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT format('VACUUM (ANALYZE) %I.%I', schemaname, tablename)
FROM pg_tables
WHERE schemaname = 'public_analytics'
ORDER BY tablename
\gexec
SQL
echo "> $(date -u) - VACUUM ANALYZE on public_analytics completed successfully"
