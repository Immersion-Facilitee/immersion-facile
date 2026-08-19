import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE agencies
    SET kind = 'france-travail'
    WHERE kind = 'pole-emploi';
  `);

  pgm.sql(`
    UPDATE agencies
    SET delegation_info = jsonb_set(
      delegation_info,
      '{delegationAgencyKind}',
      '"france-travail"'::jsonb
    )
    WHERE delegation_info ->> 'delegationAgencyKind' = 'pole-emploi';
  `);

  pgm.sql(`
    UPDATE convention_drafts
    SET agency_kind = 'france-travail'
    WHERE agency_kind = 'pole-emploi';
  `);

  pgm.sql(`
    UPDATE convention_templates
    SET agency_kind = 'france-travail'
    WHERE agency_kind = 'pole-emploi';
  `);

  pgm.sql(`
    UPDATE api_consumers
    SET rights = jsonb_set(
      rights,
      '{convention,scope,agencyKinds}',
      replace(
        (rights #> '{convention,scope,agencyKinds}')::text,
        '"pole-emploi"',
        '"france-travail"'
      )::jsonb
    )
    WHERE (rights #> '{convention,scope}') ? 'agencyKinds'
      AND rights #> '{convention,scope,agencyKinds}' @> '"pole-emploi"'::jsonb;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE agencies
    SET kind = 'pole-emploi'
    WHERE kind = 'france-travail';
  `);

  pgm.sql(`
    UPDATE agencies
    SET delegation_info = jsonb_set(
      delegation_info,
      '{delegationAgencyKind}',
      '"pole-emploi"'::jsonb
    )
    WHERE delegation_info ->> 'delegationAgencyKind' = 'france-travail';
  `);

  pgm.sql(`
    UPDATE convention_drafts
    SET agency_kind = 'pole-emploi'
    WHERE agency_kind = 'france-travail';
  `);

  pgm.sql(`
    UPDATE convention_templates
    SET agency_kind = 'pole-emploi'
    WHERE agency_kind = 'france-travail';
  `);

  pgm.sql(`
    UPDATE api_consumers
    SET rights = jsonb_set(
      rights,
      '{convention,scope,agencyKinds}',
      replace(
        (rights #> '{convention,scope,agencyKinds}')::text,
        '"france-travail"',
        '"pole-emploi"'
      )::jsonb
    )
    WHERE (rights #> '{convention,scope}') ? 'agencyKinds'
      AND rights #> '{convention,scope,agencyKinds}' @> '"france-travail"'::jsonb;
  `);
}
