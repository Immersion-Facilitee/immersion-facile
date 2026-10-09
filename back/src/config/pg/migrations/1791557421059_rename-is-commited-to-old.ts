import type { MigrationBuilder } from "node-pg-migrate";

const tableName = "establishments";
const columnName = "is_commited";
const oldColumnName = "__old_is_commited";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(tableName, columnName, oldColumnName);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(tableName, oldColumnName, columnName);
}
