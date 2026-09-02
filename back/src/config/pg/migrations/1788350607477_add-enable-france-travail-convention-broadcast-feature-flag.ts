import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    INSERT INTO feature_flags(flag_name, is_active, kind)
    VALUES ('enableFranceTravailConventionBroadcast', true, 'boolean')
    ON CONFLICT (flag_name) DO NOTHING
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DELETE FROM feature_flags
    WHERE flag_name = 'enableFranceTravailConventionBroadcast'
  `);
}
