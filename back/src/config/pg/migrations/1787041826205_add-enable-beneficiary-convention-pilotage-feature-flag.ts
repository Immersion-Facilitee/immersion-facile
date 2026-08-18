import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  await pgm.db.query(`
    INSERT INTO feature_flags(flag_name, is_active, kind)
    VALUES ('enableBeneficiaryManageConvention', true, 'boolean')
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  await pgm.db.query(`
    DELETE FROM feature_flags
    WHERE flag_name = 'enableBeneficiaryManageConvention';
  `);
}
