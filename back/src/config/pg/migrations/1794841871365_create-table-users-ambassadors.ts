import type { MigrationBuilder } from "node-pg-migrate";

const usersAmbassadorsTable = "users_ambassadors";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(usersAmbassadorsTable, {
    user_id: {
      type: "uuid",
      primaryKey: true,
      references: "users",
      onDelete: "CASCADE",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(usersAmbassadorsTable);
}
