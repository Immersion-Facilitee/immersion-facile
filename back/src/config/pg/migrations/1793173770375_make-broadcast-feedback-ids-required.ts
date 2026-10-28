import type { MigrationBuilder } from "node-pg-migrate";

const conventionIdFk = "broadcast_feedbacks_convention_id_fkey";
const compositeIndexName = "idx_bf_convention_id_occurred_at";
const simpleConventionIdIndexName = "idx_bf_convention_id";
const jsonConventionIdIndexName = "idx_broadcast_feedbacks_convention_id";
const unhandledErrorsIndexName = "idx_bf_unhandled_errors";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();

  pgm.sql(`
    DELETE FROM broadcast_feedbacks
    WHERE convention_id IS NULL
       OR agency_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM conventions
         WHERE conventions.id = broadcast_feedbacks.convention_id
       );
  `);

  pgm.addConstraint("broadcast_feedbacks", conventionIdFk, {
    foreignKeys: {
      columns: "convention_id",
      references: "conventions(id)",
      onDelete: "CASCADE",
    },
  });

  pgm.alterColumn("broadcast_feedbacks", "convention_id", {
    notNull: true,
  });
  pgm.alterColumn("broadcast_feedbacks", "agency_id", {
    notNull: true,
  });

  pgm.createIndex(
    "broadcast_feedbacks",
    ["convention_id", { name: "occurred_at", sort: "DESC" }],
    { name: compositeIndexName, concurrently: true },
  );

  pgm.dropIndex("broadcast_feedbacks", "convention_id", {
    name: simpleConventionIdIndexName,
    concurrently: true,
  });
  pgm.sql(`DROP INDEX CONCURRENTLY IF EXISTS ${jsonConventionIdIndexName};`);
  pgm.sql(`DROP INDEX CONCURRENTLY IF EXISTS ${unhandledErrorsIndexName};`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();

  pgm.dropConstraint("broadcast_feedbacks", conventionIdFk);

  pgm.dropIndex("broadcast_feedbacks", ["convention_id", "occurred_at"], {
    name: compositeIndexName,
    concurrently: true,
  });

  pgm.createIndex("broadcast_feedbacks", "convention_id", {
    name: simpleConventionIdIndexName,
    concurrently: true,
  });
  pgm.createIndex(
    "broadcast_feedbacks",
    "((request_params ->> 'conventionId')::uuid)",
    {
      name: jsonConventionIdIndexName,
    },
  );
  pgm.sql(`
    CREATE INDEX ${unhandledErrorsIndexName}
    ON broadcast_feedbacks (((request_params ->> 'conventionId')::uuid), occurred_at DESC)
    WHERE subscriber_error_feedback IS NOT NULL;
  `);

  pgm.alterColumn("broadcast_feedbacks", "convention_id", {
    notNull: false,
  });
  pgm.alterColumn("broadcast_feedbacks", "agency_id", {
    notNull: false,
  });
}
