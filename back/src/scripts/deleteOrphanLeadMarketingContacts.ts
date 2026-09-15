import "./instrumentSentryCron";
import { sql } from "kysely";
import { uniqBy } from "ramda";
import {
  castError,
  type Email,
  executeInSequence,
  type SiretDto,
} from "shared";
import { createAxiosSharedClient } from "shared-routes/axios";
import { AppConfig } from "../config/bootstrap/appConfig";
import { logPartnerResponses } from "../config/bootstrap/logPartnerResponses";
import { partnerNames } from "../config/bootstrap/partnerNames";
import { type KyselyDb, makeKyselyDb } from "../config/pg/kysely/kyselyUtils";
import { createMakeScriptPgPool } from "../config/pg/pgPool";
import { brevoContactRoutes } from "../domains/marketing/adapters/establishmentMarketingGateway/BrevoContact.routes";
import { BrevoEstablishmentMarketingGateway } from "../domains/marketing/adapters/establishmentMarketingGateway/BrevoEstablishmentMarketingGateway";
import { InMemoryEstablishmentMarketingGateway } from "../domains/marketing/adapters/establishmentMarketingGateway/InMemoryEstablishmentMarketingGateway";
import type { EstablishmentMarketingGateway } from "../domains/marketing/ports/EstablishmentMarketingGateway";
import { makeAxiosInstances } from "../utils/axiosUtils";
import { createLogger } from "../utils/logger";
import { handleCRONScript } from "./handleCRONScript";

// Script usage examples
//
// Dry run by default (nothing is deleted, only the candidates are listed):
// pnpm back delete-orphan-lead-marketing-contacts
//
// Actually delete the contacts in Brevo:
// pnpm back delete-orphan-lead-marketing-contacts --apply
//
// Delete only the first 100 candidates, to check the result on a small batch first:
// pnpm back delete-orphan-lead-marketing-contacts --apply --limit=100
//
// --limit has no effect in dry run: all the candidates are always listed.

const logger = createLogger(__filename);
const config = AppConfig.createFromEnv();

type ObsoleteMarketingContact = {
  siret: SiretDto;
  obsoleteEmail: Email;
};

export type DeleteOrphanLeadMarketingContactsResult = {
  dryRun: boolean;
  candidates: ObsoleteMarketingContact[];
  deleted: ObsoleteMarketingContact[];
  errors: (ObsoleteMarketingContact & { error: Error })[];
};

const findObsoleteMarketingContacts = async (
  db: KyselyDb,
): Promise<ObsoleteMarketingContact[]> => {
  const { rows } = await sql<{
    siret: SiretDto;
    obsolete_email: Email;
  }>`
    select
      contacts.siret,
      obsolete.email as obsolete_email
    from marketing_establishment_contacts contacts,
    lateral (
      select distinct (element ->> 'email') as email
      from jsonb_array_elements(contacts.contact_history) as element
    ) obsolete
    where obsolete.email <> contacts.email
      and not exists (
        select 1
        from marketing_establishment_contacts others
        where others.email = obsolete.email
      )
    order by contacts.siret, obsolete.email
  `.execute(db);

  return rows.map(({ siret, obsolete_email }) => ({
    siret,
    obsoleteEmail: obsolete_email,
  }));
};

const keepFirstContactPerEmail = (
  contacts: ObsoleteMarketingContact[],
): ObsoleteMarketingContact[] =>
  uniqBy(({ obsoleteEmail }) => obsoleteEmail, contacts);

export const deleteOrphanLeadMarketingContacts = async ({
  db,
  establishmentMarketingGateway,
  dryRun,
  limit,
}: {
  db: KyselyDb;
  establishmentMarketingGateway: EstablishmentMarketingGateway;
  dryRun: boolean;
  limit?: number;
}): Promise<DeleteOrphanLeadMarketingContactsResult> => {
  const candidates = keepFirstContactPerEmail(
    await findObsoleteMarketingContacts(db),
  );

  if (dryRun)
    return {
      dryRun,
      candidates,
      deleted: [],
      errors: [],
    };

  const contactsToDelete =
    limit === undefined ? candidates : candidates.slice(0, limit);

  const results = await executeInSequence(
    contactsToDelete,
    (contact): Promise<ObsoleteMarketingContact & { error: Error | null }> =>
      establishmentMarketingGateway
        .delete(contact.obsoleteEmail)
        .then(() => ({ ...contact, error: null }))
        .catch((error) => ({ ...contact, error: castError(error) })),
  );

  return {
    dryRun,
    candidates,
    deleted: results.flatMap(({ error, ...contact }) =>
      error ? [] : [contact],
    ),
    errors: results.flatMap(({ error, ...contact }) =>
      error ? [{ ...contact, error }] : [],
    ),
  };
};

const makeEstablishmentMarketingGateway = (
  appConfig: AppConfig,
): EstablishmentMarketingGateway => {
  if (appConfig.establishmentMarketingGateway !== "BREVO")
    return new InMemoryEstablishmentMarketingGateway();

  const { axiosWithValidateStatus } = makeAxiosInstances(
    appConfig.externalAxiosTimeout,
  );

  return new BrevoEstablishmentMarketingGateway({
    apiKey: appConfig.apiKeyBrevo,
    establishmentContactListId: appConfig.brevoEstablishmentContactListId,
    httpClient: createAxiosSharedClient(
      brevoContactRoutes,
      axiosWithValidateStatus,
      {
        skipResponseValidation: true,
        onResponseSideEffect: ({ route, durationInMs, response }) =>
          logPartnerResponses({
            partnerName: partnerNames.brevoEstablishmentMarketing,
          })?.({ route, durationInMs, response, input: {} }), // On ne log pas input car il y a des emails dedans
      },
    ),
  });
};

const runScript =
  async (): Promise<DeleteOrphanLeadMarketingContactsResult> => {
    const args = process.argv.slice(2);
    const limitArg = args.find((arg) => arg.startsWith("--limit="));

    const pool = createMakeScriptPgPool(config)();

    try {
      return await deleteOrphanLeadMarketingContacts({
        db: makeKyselyDb(pool),
        establishmentMarketingGateway:
          makeEstablishmentMarketingGateway(config),
        dryRun: !args.includes("--apply"),
        limit: limitArg
          ? Number.parseInt(limitArg.replace("--limit=", ""), 10)
          : undefined,
      });
    } finally {
      await pool.end();
    }
  };

const formatSirets = (contacts: ObsoleteMarketingContact[]): string =>
  contacts.map(({ siret }) => siret).join(", ");

if (require.main === module) {
  handleCRONScript({
    name: "deleteOrphanLeadMarketingContacts",
    config,
    script: runScript,
    handleResults: ({ dryRun, candidates, deleted, errors }) =>
      [
        `Mode: ${dryRun ? "dry run (nothing deleted, use --apply to delete)" : "apply"}`,
        `Obsolete marketing contacts to remove from Brevo: ${candidates.length}`,
        ...(candidates.length > 0 ? [`  ${formatSirets(candidates)}`] : []),
        `Deleted: ${deleted.length}`,
        `Errors: ${errors.length}`,
        ...(errors.length > 0 ? [`  ${formatSirets(errors)}`] : []),
      ].join("\n"),
    logger,
  });
}
