import type { MigrationBuilder } from "node-pg-migrate";

const indexName = "notifications_email_reengagement_suggestion_siret_index";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();
  pgm.addIndex("notifications_email", ["establishment_siret", "created_at"], {
    name: indexName,
    where: "email_kind = 'ESTABLISHMENT_REENGAGEMENT_SUGGESTION'",
    concurrently: true,
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();
  pgm.dropIndex("notifications_email", ["establishment_siret", "created_at"], {
    name: indexName,
    concurrently: true,
  });
}
