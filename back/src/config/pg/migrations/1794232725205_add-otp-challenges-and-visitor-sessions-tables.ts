import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType("otp_challenge_channel", ["email", "sms"]);
  pgm.createTable("otp_challenges", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    purpose: { type: "varchar(255)", notNull: true },
    subject: { type: "jsonb", notNull: true },
    channel: { type: "otp_challenge_channel", notNull: true },
    recipient: { type: "varchar(255)", notNull: true },
    code_hash: { type: "varchar(255)", notNull: true },
    attempts: { type: "integer", notNull: true, default: 0 },
    expires_at: { type: "timestamptz", notNull: true },
    used_at: { type: "timestamptz", notNull: false, default: null },
    revoked_at: { type: "timestamptz", notNull: false, default: null },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
  pgm.createIndex("otp_challenges", ["purpose", "subject"]);

  pgm.createTable("visitor_sessions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    purpose: { type: "varchar(255)", notNull: true },
    subject: { type: "jsonb", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    revoked_at: { type: "timestamptz", notNull: false, default: null },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
  pgm.createIndex("visitor_sessions", ["purpose", "subject"]);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("visitor_sessions");
  pgm.dropTable("otp_challenges");
  pgm.dropType("otp_challenge_channel");
}
