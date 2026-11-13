import type { MigrationBuilder } from "node-pg-migrate";

const indexName = "idx_bf_unhandled_errors_convention_id_occurred_at";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();

  pgm.sql(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
    ON broadcast_feedbacks (convention_id, occurred_at DESC)
    WHERE subscriber_error_feedback IS NOT NULL AND handled_by_agency = false;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();

  pgm.sql(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName};`);
}
