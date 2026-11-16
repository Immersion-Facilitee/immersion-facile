import type { MigrationBuilder } from "node-pg-migrate";

const unhandledErrorsIndexName =
  "idx_bf_unhandled_errors_convention_id_occurred_at";
const unusedAgencyIndexName = "idx_bf_agency_id_occurred_at";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();

  pgm.sql(`DROP INDEX CONCURRENTLY IF EXISTS ${unusedAgencyIndexName};`);

  pgm.sql(`
    CREATE INDEX CONCURRENTLY ${unhandledErrorsIndexName}
    ON broadcast_feedbacks (convention_id, occurred_at DESC)
    WHERE subscriber_error_feedback IS NOT NULL AND handled_by_agency = false;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();

  pgm.sql(`DROP INDEX CONCURRENTLY IF EXISTS ${unhandledErrorsIndexName};`);

  pgm.sql(`
    CREATE INDEX CONCURRENTLY ${unusedAgencyIndexName}
    ON broadcast_feedbacks (agency_id, occurred_at DESC);
  `);
}
