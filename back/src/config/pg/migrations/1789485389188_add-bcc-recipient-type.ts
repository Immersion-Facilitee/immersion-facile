/* eslint-disable @typescript-eslint/naming-convention */
import type { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`ALTER TYPE recipient_type ADD VALUE IF NOT EXISTS 'bcc';`);
}

export async function down(_: MigrationBuilder): Promise<void> {}
