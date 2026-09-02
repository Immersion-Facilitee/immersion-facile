import type { MigrationBuilder } from "node-pg-migrate";

const oldContactsTableName = "immersion_contacts";
const newContactsTableName = "establishments_contacts";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // drop views
  pgm.dropMaterializedView("view_establishments_with_aggregated_offers");
  pgm.dropMaterializedView("view_establishments_with_flatten_offers");
  pgm.dropMaterializedView("view_establishments");

  //rename table immersion contact
  pgm.renameTable(oldContactsTableName, newContactsTableName);

  // add siret column and constraint to table establishment contacts
  pgm.addColumn(newContactsTableName, {
    siret: { type: "char(14)", notNull: false },
  });

  pgm.addConstraint(newContactsTableName, "fk_siret", {
    foreignKeys: {
      columns: "siret",
      references: "establishments(siret)",
      onDelete: "CASCADE", // If an establishment is deleted, will delete the contact referencing the siret
    },
  });
  pgm.createIndex(newContactsTableName, "siret");

  pgm.sql(`
  DELETE FROM ${newContactsTableName}
  WHERE uuid NOT IN (
  SELECT contact_uuid
  FROM "establishments__immersion_contacts"
  );
  `);

  // insert data from joint table to establishment contacts
  pgm.sql(`
  UPDATE ${newContactsTableName}
  SET "siret" = eic.establishment_siret
  FROM "establishments__immersion_contacts" eic
  WHERE ${newContactsTableName}.uuid = eic.contact_uuid;
`);

  pgm.alterColumn(newContactsTableName, "siret", {
    type: "char(14)",
    notNull: true,
  });

  // create view
  createEstablishmentsView(pgm, "up");
  createEstablishmentsWithAggredatedOffersView(pgm);
  createEstablishmentsWithFlattedOffersView(pgm);

  // drop joint table
  pgm.dropTable("establishments__immersion_contacts");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // drop views
  pgm.dropMaterializedView("view_establishments_with_aggregated_offers");
  pgm.dropMaterializedView("view_establishments_with_flatten_offers");
  pgm.dropMaterializedView("view_establishments");

  //rename table establishment contacts
  pgm.renameTable(newContactsTableName, oldContactsTableName);

  // create joitn table and add constraints
  pgm.createTable("establishments__immersion_contacts", {
    establishment_siret: { type: "char(14)", notNull: true, primaryKey: true },
    contact_uuid: { type: "uuid", notNull: true, primaryKey: true },
  });
  pgm.addConstraint(
    "establishments__immersion_contacts",
    "fk_establishment_siret",
    {
      foreignKeys: {
        columns: "establishment_siret",
        references: "establishments(siret)",
        onDelete: "CASCADE", // If an establishment is deleted, will delete the rows referencing the siret
      },
    },
  );
  pgm.addConstraint("establishments__immersion_contacts", "fk_contact_uuid", {
    foreignKeys: {
      columns: "contact_uuid",
      references: "immersion_contacts(uuid)",
      onDelete: "CASCADE", // If a contact is deleted, will delete the rows referencing the contact_uuid
    },
  });

  // Migrate data from immersion_contacts table
  pgm.sql(`
    INSERT INTO establishments__immersion_contacts(establishment_siret, contact_uuid)
    SELECT siret, uuid from immersion_contacts;   
  `);

  // remove constraint and column from immersion_contact
  pgm.createIndex(oldContactsTableName, "siret");
  pgm.dropConstraint(oldContactsTableName, "fk_siret");
  pgm.dropColumn(oldContactsTableName, "siret");

  // create views
  createEstablishmentsView(pgm, "down");
  createEstablishmentsWithAggredatedOffersView(pgm);
  createEstablishmentsWithFlattedOffersView(pgm);
}

const createEstablishmentsView = (
  pgm: MigrationBuilder,
  direction: "up" | "down",
) => {
  pgm.sql(`
    create materialized view if not exists public.view_establishments as
WITH count_conventions_by_siret AS (SELECT conventions.siret,
                                           count(*) AS count
                                    FROM conventions
                                    WHERE conventions.status::text = 'ACCEPTED_BY_VALIDATOR'::text
                                    GROUP BY conventions.siret),
     count_contact_requests_by_siret AS (SELECT DISTINCT count(discussions.siret) AS count,
                                                         discussions.siret
                                         FROM discussions
                                         GROUP BY discussions.siret)
SELECT DISTINCT e.created_at                          AS "Date de référencement",
                e.update_date                         AS "Date de mise à jour",
                e.siret                               AS "Siret",
                e.name                                AS "Raison Sociale",
                e.customized_name                     AS "Enseigne",
                loc.street_number_and_address         AS "Adresse",
                loc.post_code                         AS "Code Postal",
                loc.city                              AS "Ville",
                sdr.department_name                   AS "Département",
                sdr.region_name                       AS "Région",
                e.naf_code                            AS "NAF",
                pnc.class_id                          AS "Id Classe NAF",
                pnc.class_label                       AS "Classe NAF",
                pnc.group_id                          AS "Id Groupe NAF",
                pnc.group_label                       AS "Groupe NAF",
                pnc.division_id                       AS "Id Division NAF",
                pnc.division_label                    AS "Division NAF",
                pnc.section_id                        AS "Id Section NAF",
                pnc.section_label                     AS "Section NAF",
                e.number_employees                    AS "Nombre d’employés",
                ${
                  direction === "down"
                    ? `concat(ic.firstname, ic.lastname)     AS "Contact",
                    ic.job                                AS "Rôle du contact",
                    ic.email                              AS "Email du contact",
                    ic.phone                              AS "Téléphone du contact",
                    CASE
                        WHEN ic.contact_mode = 'PHONE'::contact_mode THEN 'Téléphone'::text
                        WHEN ic.contact_mode = 'IN_PERSON'::contact_mode THEN 'En personne'::text
                        ELSE 'Email'::text
                        END                               AS "Mode de contact",`
                    : `concat(ec.firstname, ec.lastname)     AS "Contact",
                    ec.job                                AS "Rôle du contact",
                    ec.email                              AS "Email du contact",
                    ec.phone                              AS "Téléphone du contact",
                    CASE
                        WHEN ec.contact_mode = 'PHONE'::contact_mode THEN 'Téléphone'::text
                        WHEN ec.contact_mode = 'IN_PERSON'::contact_mode THEN 'En personne'::text
                        ELSE 'Email'::text
                        END                               AS "Mode de contact",`
                }
                
                CASE
                    WHEN e.is_commited THEN 'Oui'::text
                    ELSE 'Non déclaré'::text
                    END                               AS "Appartenance Réseau « Les entreprises s’engagent »",
                CASE
                    WHEN e.is_searchable THEN 'Oui'::text
                    ELSE 'Non'::text
                    END                               AS "Visible",
                e.source_provider                     AS "Origine",
                COALESCE(count_rel.count, 0::bigint)  AS "Nombre de mise en relation pour cette entreprise",
                COALESCE(count_conv.count, 0::bigint) AS "Nombre de convention validée pour cette entreprise"
FROM establishments e
         ${
           direction === "down"
             ? `LEFT JOIN establishments__immersion_contacts eic ON eic.establishment_siret = e.siret
                LEFT JOIN immersion_contacts ic ON eic.contact_uuid = ic.uuid`
             : "LEFT JOIN establishments_contacts ec ON e.siret = ec.siret"
}
         LEFT JOIN view_siret_with_department_region sdr ON sdr.siret = e.siret
         LEFT JOIN public_naf_classes_2008 pnc
                   ON pnc.class_id::text = regexp_replace(e.naf_code::text,'(\\d{2})(\\d{2}).*'::text, '\\1.\\2'::text
                   )
         LEFT JOIN count_contact_requests_by_siret count_rel ON count_rel.siret = e.siret
         LEFT JOIN count_conventions_by_siret count_conv ON count_conv.siret = e.siret
         LEFT JOIN establishments_locations loc ON loc.establishment_siret = e.siret;
    `);
};

const createEstablishmentsWithAggredatedOffersView = (
  pgm: MigrationBuilder,
) => {
  pgm.sql(`
  create materialized view if not exists public.view_establishments_with_aggregated_offers as
WITH offers_by_siret AS (SELECT e.siret,
                                array_agg(pad.libelle_appellation_long) AS appelation_labels,
                                array_agg(io_1.rome_code)               AS rome_codes
                         FROM establishments e
                                  LEFT JOIN immersion_offers io_1 ON io_1.siret = e.siret
                                  LEFT JOIN public_appellations_data pad ON pad.code_rome::bpchar = io_1.rome_code AND
                                                                            pad.ogr_appellation = io_1.appellation_code
                         GROUP BY e.siret)
SELECT view_establishments."Date de référencement",
       view_establishments."Date de mise à jour",
       view_establishments."Siret",
       view_establishments."Raison Sociale",
       view_establishments."Enseigne",
       view_establishments."Adresse",
       view_establishments."Code Postal",
       view_establishments."Ville",
       view_establishments."Département",
       view_establishments."Région",
       view_establishments."NAF",
       view_establishments."Id Classe NAF",
       view_establishments."Classe NAF",
       view_establishments."Id Groupe NAF",
       view_establishments."Groupe NAF",
       view_establishments."Id Division NAF",
       view_establishments."Division NAF",
       view_establishments."Id Section NAF",
       view_establishments."Section NAF",
       view_establishments."Nombre d’employés",
       view_establishments."Contact",
       view_establishments."Rôle du contact",
       view_establishments."Email du contact",
       view_establishments."Téléphone du contact",
       view_establishments."Mode de contact",
       view_establishments."Appartenance Réseau « Les entreprises s’engagent »",
       view_establishments."Visible",
       view_establishments."Origine",
       view_establishments."Nombre de mise en relation pour cette entreprise",
       view_establishments."Nombre de convention validée pour cette entreprise",
       io.rome_codes        AS "Codes Métier",
       io.appelation_labels AS "Métiers"
FROM view_establishments
         LEFT JOIN offers_by_siret io ON io.siret = view_establishments."Siret";
  `);
};

const createEstablishmentsWithFlattedOffersView = (pgm: MigrationBuilder) => {
  pgm.sql(`
  create materialized view if not exists public.view_establishments_with_flatten_offers as
WITH offers_by_siret AS (SELECT e.siret,
                                pad.libelle_appellation_long AS appelation_labels,
                                io_1.rome_code
                         FROM establishments e
                                  LEFT JOIN immersion_offers io_1 ON io_1.siret = e.siret
                                  LEFT JOIN public_appellations_data pad ON pad.code_rome::bpchar = io_1.rome_code AND
                                                                            pad.ogr_appellation = io_1.appellation_code)
SELECT view_establishments."Date de référencement",
       view_establishments."Date de mise à jour",
       view_establishments."Siret",
       view_establishments."Raison Sociale",
       view_establishments."Enseigne",
       view_establishments."Adresse",
       view_establishments."Code Postal",
       view_establishments."Ville",
       view_establishments."Département",
       view_establishments."Région",
       view_establishments."NAF",
       view_establishments."Id Classe NAF",
       view_establishments."Classe NAF",
       view_establishments."Id Groupe NAF",
       view_establishments."Groupe NAF",
       view_establishments."Id Division NAF",
       view_establishments."Division NAF",
       view_establishments."Id Section NAF",
       view_establishments."Section NAF",
       view_establishments."Nombre d’employés",
       view_establishments."Contact",
       view_establishments."Rôle du contact",
       view_establishments."Email du contact",
       view_establishments."Téléphone du contact",
       view_establishments."Mode de contact",
       view_establishments."Appartenance Réseau « Les entreprises s’engagent »",
       view_establishments."Visible",
       view_establishments."Origine",
       view_establishments."Nombre de mise en relation pour cette entreprise",
       view_establishments."Nombre de convention validée pour cette entreprise",
       io.rome_code         AS "Code Métier",
       io.appelation_labels AS "Métier"
FROM view_establishments
         LEFT JOIN offers_by_siret io ON io.siret = view_establishments."Siret";`);
};
