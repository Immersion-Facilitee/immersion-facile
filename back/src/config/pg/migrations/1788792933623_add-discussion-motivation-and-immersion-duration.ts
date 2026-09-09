import type { MigrationBuilder } from "node-pg-migrate";

const table = "discussions";
const motivationColumn = "potential_beneficiary_motivation";
const immersionDurationColumn = "potential_beneficiary_immersion_duration";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(table, {
    [motivationColumn]: { type: "text", notNull: false },
    [immersionDurationColumn]: { type: "text", notNull: false },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(table, motivationColumn);
  pgm.dropColumn(table, immersionDurationColumn);
}
