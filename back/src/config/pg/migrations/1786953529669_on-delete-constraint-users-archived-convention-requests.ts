/* eslint-disable @typescript-eslint/naming-convention */
import type { MigrationBuilder } from "node-pg-migrate";

const tableName = "archived_convention_requests";
const constraintName = "archived_convention_requests_user_id_fk";
const columnName = "user_id";
const referenceName = "users(id)";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint(tableName, constraintName);

  pgm.addConstraint(tableName, constraintName, {
    foreignKeys: {
      columns: columnName,
      references: referenceName,
      onDelete: "CASCADE",
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint(tableName, constraintName);

  pgm.addConstraint(tableName, constraintName, {
    foreignKeys: {
      columns: columnName,
      references: referenceName,
    },
  });
}
