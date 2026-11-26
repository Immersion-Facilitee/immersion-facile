import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE notifications_email
    SET email_kind = 'LINK_RENEWAL',
        params = (params - 'magicLink') || jsonb_build_object('link', params->'magicLink')
    WHERE email_kind = 'MAGIC_LINK_RENEWAL'
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE notifications_email
    SET email_kind = 'MAGIC_LINK_RENEWAL',
        params = (params - 'link') || jsonb_build_object('magicLink', params->'link')
    WHERE email_kind = 'LINK_RENEWAL'
  `);
}
