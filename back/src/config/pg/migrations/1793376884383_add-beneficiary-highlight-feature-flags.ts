import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
      INSERT INTO "feature_flags" (flag_name, kind, is_active, value)
      VALUES ('enableBeneficiaryDashboardHighlight', 'highlight', false, '{"title": "Titre par défaut pour candidat" , "message": "Message par défaut pour candidat","href":"https://www.exemple.com", "label":"Bouton par défaut pour candidat" }');
    `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
      DELETE FROM "feature_flags" WHERE flag_name = 'enableBeneficiaryDashboardHighlight';
    `);
}
