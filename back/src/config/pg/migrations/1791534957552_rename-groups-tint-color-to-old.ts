/* eslint-disable @typescript-eslint/naming-convention */
import type { MigrationBuilder } from "node-pg-migrate";

const tableName = "groups";
const currentColumnName = "tint_color";
const oldColumnName = "__old_tint_color";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(tableName, currentColumnName, oldColumnName);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn(tableName, oldColumnName, currentColumnName);
}
