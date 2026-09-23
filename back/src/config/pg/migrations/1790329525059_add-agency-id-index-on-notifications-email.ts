/* eslint-disable @typescript-eslint/naming-convention */
import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addIndex("notifications_email", "agency_id", {
    name: "notifications_email_agency_id_index",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("notifications_email", "agency_id", {
    name: "notifications_email_agency_id_index",
  });
}
