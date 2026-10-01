import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("immersion_assessments", {
    created_by_role: { type: "varchar(255)", notNull: false },
    created_by_user_id: {
      type: "uuid",
      notNull: false,
      references: { name: "users" },
      onDelete: "SET NULL",
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("immersion_assessments", [
    "created_by_role",
    "created_by_user_id",
  ]);
}
