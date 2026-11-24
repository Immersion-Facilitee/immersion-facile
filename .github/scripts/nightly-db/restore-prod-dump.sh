#!/usr/bin/env bash
set -euo pipefail

echo "> $(date) - Installing tools"
install-scalingo-cli
dbclient-fetcher pgsql 17

echo "> $(date) - Dumping prod DB (excluding large unused tables)"
/app/bin/pg_dump --dbname="$SOURCE_PROD_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --no-comments \
  --exclude-table=outbox \
  --exclude-table=outbox_publications \
  --exclude-table=outbox_failures \
  --exclude-table=notifications_email \
  --exclude-table=notifications_email_recipients \
  --exclude-table=notifications_email_attachments \
  --exclude-table=notifications_sms \
  --exclude-table=short_links \
  --exclude-table=spatial_ref_sys \
  --exclude-table=searches_made \
  --exclude-table=searches_made__appellation_code \
  --exclude-table=searches_made__naf_code \
  --exclude-table-data=users_ongoing_oauths \
  --exclude-schema=tiger \
  --exclude-schema=tiger_data \
  --exclude-schema=topology \
  --exclude-schema="metabase*" \
  --file=dump.pgsql

echo "> $(date) - Dump complete, dropping nightly data"
psql "$SCALINGO_POSTGRESQL_URL" -c 'DROP OWNED BY CURRENT_USER CASCADE;'

echo "> $(date) - Add Postgis extension if not exists"
psql "$SCALINGO_POSTGRESQL_URL" -c 'CREATE EXTENSION IF NOT EXISTS postgis;'

restore_dump() {
  /app/bin/pg_restore \
    --dbname="$SCALINGO_POSTGRESQL_URL" \
    --verbose \
    --no-owner \
    --no-privileges \
    --disable-triggers \
    --exit-on-error \
    "$@" \
    dump.pgsql 2>&1 | awk '{print strftime("%Y-%m-%d %H:%M:%S"), $0; fflush()}'
}

echo "> $(date) - Restoring schema to nightly"
restore_dump --section=pre-data

echo "> $(date) - Switching restored tables to unlogged"
psql "$SCALINGO_POSTGRESQL_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT format('ALTER TABLE public.%I SET UNLOGGED', tablename)
FROM pg_tables
WHERE schemaname = 'public' AND tablename <> 'spatial_ref_sys'
\gexec
SQL

echo "> $(date) - Restoring data, indexes and constraints to nightly"
restore_dump --section=data --section=post-data --jobs=8

echo "> $(date) - Cleaning up dump file"
rm -f dump.pgsql

echo "> $(date) - Finished restoring"
