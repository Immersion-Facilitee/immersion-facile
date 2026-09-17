/* eslint-disable @typescript-eslint/naming-convention */
import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addIndex("notifications_email", "establishment_siret", {
    name: "notifications_email_establishment_siret_index",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex(
    "notifications_email",
    "notifications_email_establishment_siret_index",
  );
}
