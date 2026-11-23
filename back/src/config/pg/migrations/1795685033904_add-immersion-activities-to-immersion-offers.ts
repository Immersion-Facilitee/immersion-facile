import type { MigrationBuilder } from "node-pg-migrate";

const tableName = "immersion_offers";
const columnName = "immersion_activities";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(tableName, {
    [columnName]: {
      type: "text",
      notNull: false,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(tableName, columnName);
}
