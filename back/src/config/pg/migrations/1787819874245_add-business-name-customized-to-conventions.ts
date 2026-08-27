/* eslint-disable @typescript-eslint/naming-convention */
import type { MigrationBuilder } from "node-pg-migrate";

const conventionTableName = "conventions";
const conventionDraftsTableName = "convention_drafts";
const conventionTemplatesTableName = "convention_templates";

const column = {
  business_name_customized: {
    type: "varchar(255)",
    notNull: false,
  },
};

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(conventionTableName, column);
  pgm.addColumn(conventionDraftsTableName, column);
  pgm.addColumn(conventionTemplatesTableName, column);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(conventionTableName, "business_name_customized");
  pgm.dropColumn(conventionDraftsTableName, "business_name_customized");
  pgm.dropColumn(conventionTemplatesTableName, "business_name_customized");
}
