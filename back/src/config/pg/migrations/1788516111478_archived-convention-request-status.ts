import type { MigrationBuilder } from "node-pg-migrate";
import { archivedConventionRequestStatuses } from "shared";

const tableName = "archived_convention_requests";
const statusTypeName = "archived_convention_request_status";
const statusColumn = "status";
const updatedAtColumn = "updated_at";
const handledAtColumn = "handled_at";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType(statusTypeName, [...archivedConventionRequestStatuses]);
  pgm.addColumns(tableName, {
    [statusColumn]: {
      type: statusTypeName,
      notNull: true,
      default: "PENDING",
    },
    [updatedAtColumn]: {
      type: "timestamptz",
      notNull: false,
    },
  });
  pgm.sql(`
    UPDATE ${tableName}
    SET
      ${updatedAtColumn} = COALESCE(${handledAtColumn}, created_at),
      ${statusColumn} = CASE
        WHEN ${handledAtColumn} IS NOT NULL THEN 'TREATED'::${statusTypeName}
        ELSE 'PENDING'::${statusTypeName}
      END
  `);
  pgm.alterColumn(tableName, updatedAtColumn, { notNull: true });
  pgm.dropColumn(tableName, handledAtColumn);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(tableName, {
    [handledAtColumn]: {
      type: "timestamptz",
      notNull: false,
      default: null,
    },
  });
  pgm.sql(`
    UPDATE ${tableName}
    SET ${handledAtColumn} = ${updatedAtColumn}
    WHERE ${statusColumn} <> 'PENDING'
  `);
  pgm.dropColumns(tableName, [statusColumn, updatedAtColumn]);
  pgm.dropType(statusTypeName);
}
