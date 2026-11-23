import type { MigrationBuilder } from "node-pg-migrate";

const establishmentsNameTrgmIndex = "establishments_name_trgm_index";
const establishmentsCustomizedNameTrgmIndex =
  "establishments_customized_name_trgm_index";
const usersFullNameTrgmIndex = "users_full_name_trgm_index";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE INDEX ${establishmentsNameTrgmIndex}
    ON establishments USING gin (name gin_trgm_ops)
  `);
  pgm.sql(`
    CREATE INDEX ${establishmentsCustomizedNameTrgmIndex}
    ON establishments USING gin (customized_name gin_trgm_ops)
  `);
  pgm.sql(`
    CREATE INDEX ${usersFullNameTrgmIndex}
    ON users USING gin ((first_name || ' ' || last_name || ' ' || first_name) gin_trgm_ops)
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP INDEX ${usersFullNameTrgmIndex}`);
  pgm.sql(`DROP INDEX ${establishmentsCustomizedNameTrgmIndex}`);
  pgm.sql(`DROP INDEX ${establishmentsNameTrgmIndex}`);
}
