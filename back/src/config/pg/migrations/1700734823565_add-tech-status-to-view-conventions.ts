import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  recreateViewConventions(pgm, "up");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  recreateViewConventions(pgm, "down");
}

const recreateViewConventions = (
  pgm: MigrationBuilder,
  direction: "up" | "down",
) => {
  pgm.dropView("view_conventions");
  pgm.sql(`
  create view view_conventions
            (id, "Structure", "Type de structure", "Département de la structure", "Région de la structure",
             "Date de la demande", "Date de validation", "Statut", ${
               direction === "up" ? '"tech_status", ' : ""
}
             "Accepté par l'entreprise", "Accepté par le bénéficiaire", "Accepté par le rep. légal du bénéfiaire",
             "Accepté par l'employeur actuel du bénéficiaire", "Date de début", "Date de fin",
             "Objectif de l'immersion", "Métier observé", "Rome du métier observé",
             "Conditions de travail particulières", "Activités", "Compétences développées", "Programme",
             "Total jours d'immersion", "Total heures d'immersion", "Code Postal", "Bénéficiaire", "Email bénéficiaire",
             "Téléphone bénéficiaire", "Date de naissance", "Contact d'urgence", "Téléphone du contact d'urgence",
             "Rep. légal du bénéficiaire", "Email rep. légal", "Téléphone rep. légal",
             "Employeur actuel du bénéficiaire", "Email de l'employeur actuel du bénéficiaire",
             "Téléphone de l'employeur actuel du bénéficiaire", "Protection individuelle", "Prévention sanitaire",
             "Descriptif des préventions sanitaires", "Identifiant Externe Pole Emploi", "Siret", "Référencement IF",
             "Source du référencement", "Entreprise", "Tuteur de l'entreprise", "Téléphone du tuteur de l'entreprise",
             "Email du tuteur de l'entreprise", "Rep. de l'entreprise", "Téléphone du rep. de l'entreprise",
             "Email du rep. de l'entreprise", "Issue de l'immersion", "Date du bilan", "Commentaire du bilan",
             "StructureId", "Date de création", "Date de mise à jour" )
as
SELECT c.id,
       a."Nom"                                                                        AS "Structure",
       a."Type"                                                                       AS "Type de structure",
       a."Département"                                                                AS "Département de la structure",
       a."Région"                                                                     AS "Région de la structure",
       c.date_submission                                                              AS "Date de la demande",
       c.date_validation                                                              AS "Date de validation",
       cst.translation                                                                AS "Statut",
       ${direction === "up" ? 'c.status AS "tech_status",' : ""}
       CASE
           WHEN er.signed_at IS NOT NULL THEN 'Oui'::text
           ELSE 'Non'::text
           END                                                                        AS "Accepté par l'entreprise",
       CASE
           WHEN b.signed_at IS NOT NULL THEN 'Oui'::text
           ELSE 'Non'::text
           END                                                                        AS "Accepté par le bénéficiaire",
       CASE
           WHEN c.beneficiary_representative_id IS NULL THEN 'N/A'::text
           ELSE
               CASE
                   WHEN br.signed_at IS NOT NULL THEN 'Oui'::text
                   ELSE 'Non'::text
                   END
           END                                                                        AS "Accepté par le rep. légal du bénéfiaire",
       CASE
           WHEN c.beneficiary_current_employer_id IS NULL THEN 'N/A'::text
           ELSE
               CASE
                   WHEN bce.signed_at IS NOT NULL THEN 'Oui'::text
                   ELSE 'Non'::text
                   END
           END                                                                        AS "Accepté par l'employeur actuel du bénéficiaire",
       c.date_start                                                                   AS "Date de début",
       c.date_end                                                                     AS "Date de fin",
       c.immersion_objective                                                          AS "Objectif de l'immersion",
       pad.libelle_appellation_long                                                   AS "Métier observé",
       prd.code_rome                                                                  AS "Rome du métier observé",
       c.work_conditions                                                              AS "Conditions de travail particulières",
       c.immersion_activities                                                         AS "Activités",
       c.immersion_skills                                                             AS "Compétences développées",
       c.schedule -> 'complexSchedule'::text                                          AS "Programme",
       (c.schedule -> 'workedDays'::text)::numeric                                    AS "Total jours d'immersion",
       (c.schedule -> 'totalHours'::text)::numeric                                    AS "Total heures d'immersion",
       (regexp_match(c.immersion_address::text, '\\d{5}'::text))[1]                    AS "Code Postal",
       concat(b.first_name, ' ', b.last_name)                                         AS "Bénéficiaire",
       b.email                                                                        AS "Email bénéficiaire",
       b.phone                                                                        AS "Téléphone bénéficiaire",
       (b.extra_fields ->> 'birthdate'::text)::timestamp with time zone               AS "Date de naissance",
       b.extra_fields ->> 'emergencyContact'::text                                    AS "Contact d'urgence",
       b.extra_fields ->> 'emergencyContactPhone'::text                               AS "Téléphone du contact d'urgence",
       concat(br.first_name, ' ', br.last_name)                                       AS "Rep. légal du bénéficiaire",
       br.email                                                                       AS "Email rep. légal",
       br.phone                                                                       AS "Téléphone rep. légal",
       concat(bce.first_name, ' ', bce.last_name)                                     AS "Employeur actuel du bénéficiaire",
       bce.email                                                                      AS "Email de l'employeur actuel du bénéficiaire",
       bce.phone                                                                      AS "Téléphone de l'employeur actuel du bénéficiaire",
       c.individual_protection                                                        AS "Protection individuelle",
       c.sanitary_prevention                                                          AS "Prévention sanitaire",
       c.sanitary_prevention_description                                              AS "Descriptif des préventions sanitaires",
       p.user_pe_external_id                                                          AS "Identifiant Externe Pole Emploi",
       c.siret                                                                        AS "Siret",
       CASE
           WHEN fe.siret IS NOT NULL THEN 'Oui'::text
           ELSE 'Non'::text
           END                                                                        AS "Référencement IF",
       fe.source                                                                      AS "Source du référencement",
       c.business_name                                                                AS "Entreprise",
       concat(et.first_name, ' ', et.last_name, ' ', et.extra_fields ->> 'job'::text) AS "Tuteur de l'entreprise",
       et.phone                                                                       AS "Téléphone du tuteur de l'entreprise",
       et.email                                                                       AS "Email du tuteur de l'entreprise",
       concat(er.first_name, ' ', er.last_name)                                       AS "Rep. de l'entreprise",
       er.phone                                                                       AS "Téléphone du rep. de l'entreprise",
       er.email                                                                       AS "Email du rep. de l'entreprise",
       ass.status                                                                     AS "Issue de l'immersion",
       ass.created_at                                                                 AS "Date du bilan",
       ass.establishment_feedback                                                     AS "Commentaire du bilan",
       a.id                                                                           AS "StructureId",
       c.created_at                                                                   AS "Date de création",
       c.updated_at                                                                   AS "Date de mise à jour"
FROM conventions c
         LEFT JOIN view_agencies a ON a.id = c.agency_id
         LEFT JOIN partners_pe_connect p ON p.convention_id = c.id
         LEFT JOIN public_appellations_data pad ON pad.ogr_appellation = c.immersion_appellation
         LEFT JOIN public_romes_data prd ON pad.code_rome::bpchar = prd.code_rome
         LEFT JOIN form_establishments fe ON fe.siret = c.siret
         LEFT JOIN immersion_assessments ass ON ass.convention_id = c.id
         LEFT JOIN actors b ON c.beneficiary_id = b.id
         LEFT JOIN actors et ON c.establishment_tutor_id = et.id
         LEFT JOIN actors er ON c.establishment_representative_id = er.id
         LEFT JOIN actors br ON c.beneficiary_representative_id = br.id
         LEFT JOIN convention_status_translations cst ON c.status = cst.status
         LEFT JOIN actors bce ON c.beneficiary_current_employer_id = bce.id;
`);
};
