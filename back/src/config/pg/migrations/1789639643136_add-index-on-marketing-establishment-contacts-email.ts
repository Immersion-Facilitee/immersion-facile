import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addIndex("marketing_establishment_contacts", "email");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("marketing_establishment_contacts", "email");
}
