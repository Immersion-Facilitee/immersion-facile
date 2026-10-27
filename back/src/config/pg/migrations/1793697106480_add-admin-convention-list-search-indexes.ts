import type { MigrationBuilder } from "node-pg-migrate";

const actorsFullNameTrgmIndex = "actors_full_name_trgm_index";
const conventionsBusinessNameTrgmIndex = "conventions_business_name_trgm_index";
const conventionsDateSubmissionIndex = "conventions_date_submission_index";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE INDEX ${actorsFullNameTrgmIndex}
    ON actors USING gin ((first_name || ' ' || last_name || ' ' || first_name) gin_trgm_ops)
  `);
  pgm.sql(`
    CREATE INDEX ${conventionsBusinessNameTrgmIndex}
    ON conventions USING gin (business_name gin_trgm_ops)
  `);
  pgm.sql(`
    CREATE INDEX ${conventionsDateSubmissionIndex}
    ON conventions (date_submission DESC, id)
  `);
  pgm.sql("ANALYZE actors");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP INDEX ${conventionsDateSubmissionIndex}`);
  pgm.sql(`DROP INDEX ${conventionsBusinessNameTrgmIndex}`);
  pgm.sql(`DROP INDEX ${actorsFullNameTrgmIndex}`);
}
