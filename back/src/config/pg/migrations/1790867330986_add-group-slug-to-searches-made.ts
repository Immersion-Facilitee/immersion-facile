import type { MigrationBuilder } from "node-pg-migrate";

const tableName = "searches_made";
const columnName = "group_slug";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(tableName, {
    [columnName]: { type: "text", default: null },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(tableName, columnName);
}
