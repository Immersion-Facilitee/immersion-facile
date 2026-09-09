import type { MigrationBuilder } from "node-pg-migrate";

const motivationDefault = "Non renseigné";
const experienceAdditionalInformationDefault = "Non renseigné";
const immersionDurationDefault = "flexible";
const datePreferencesDefault = "Non renseignées";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE discussions
    SET
      potential_beneficiary_motivation = COALESCE(
        potential_beneficiary_motivation,
        '${motivationDefault}'
      ),
      potential_beneficiary_experience_additional_information = COALESCE(
        potential_beneficiary_experience_additional_information,
        '${experienceAdditionalInformationDefault}'
      ),
      potential_beneficiary_immersion_duration = COALESCE(
        potential_beneficiary_immersion_duration,
        '${immersionDurationDefault}'
      )
    WHERE
      kind = 'IF'
      AND (
        potential_beneficiary_motivation IS NULL
        OR potential_beneficiary_experience_additional_information IS NULL
        OR potential_beneficiary_immersion_duration IS NULL
      )
  `);

  pgm.sql(`
    UPDATE discussions
    SET potential_beneficiary_date_preferences = '${datePreferencesDefault}'
    WHERE potential_beneficiary_date_preferences = ''
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE discussions
    SET
      potential_beneficiary_motivation = NULLIF(
        potential_beneficiary_motivation,
        '${motivationDefault}'
      ),
      potential_beneficiary_experience_additional_information = NULLIF(
        potential_beneficiary_experience_additional_information,
        '${experienceAdditionalInformationDefault}'
      ),
      potential_beneficiary_immersion_duration = NULLIF(
        potential_beneficiary_immersion_duration,
        '${immersionDurationDefault}'
      )
    WHERE kind = 'IF'
  `);

  pgm.sql(`
    UPDATE discussions
    SET potential_beneficiary_date_preferences = ''
    WHERE potential_beneficiary_date_preferences = '${datePreferencesDefault}'
  `);
}
