import type { MigrationBuilder } from "node-pg-migrate";

const unusedOutboxIndexes = [
  {
    name: "outbox_payload_agency_id_index",
    expression: `("payload" -> 'agency' ->> 'id')`,
  },
  {
    name: "outbox_payload_formEstablishment_siret_index",
    expression: `("payload" -> 'formEstablishment' ->> 'siret')`,
  },
  {
    name: "outbox_payload_establishmentAggregate_establishment_siret_index",
    expression: `("payload" -> 'establishmentAggregate' -> 'establishment' ->> 'siret')`,
  },
  {
    name: "outbox_payload_discussion_siret_index",
    expression: `("payload" -> 'discussion' ->> 'siret')`,
  },
  { name: "outbox_priority_index", expression: "priority" },
];

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();

  for (const { name } of unusedOutboxIndexes)
    pgm.dropIndex("outbox", [], { name, concurrently: true, ifExists: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.noTransaction();

  for (const { name, expression } of unusedOutboxIndexes)
    pgm.addIndex("outbox", expression, {
      name,
      concurrently: true,
      ifNotExists: true,
    });
}
