/* eslint-disable @typescript-eslint/naming-convention */
import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  const column = {
    acquisition_medium: { type: "varchar(50)", notNull: false },
  };
  pgm.addColumns("conventions", column);
  pgm.addColumns("convention_drafts", column);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns("conventions", "acquisition_medium");
  pgm.dropColumns("convention_drafts", "acquisition_medium");
}
