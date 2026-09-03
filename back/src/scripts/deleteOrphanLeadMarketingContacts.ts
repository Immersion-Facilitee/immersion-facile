import "./instrumentSentryCron";
import { sql } from "kysely";
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

const logger = createLogger(__filename);
const config = AppConfig.createFromEnv();

const maxSiretsInReport = 20;

type ObsoleteMarketingContact = {
  siret: SiretDto;
  obsoleteEmail: Email;
  isRegisteredEstablishment: boolean;
};

export type DeleteOrphanLeadMarketingContactsResult = {
  dryRun: boolean;
  candidates: ObsoleteMarketingContact[];
  notProcessedForUnregisteredSiret: ObsoleteMarketingContact[];
  deleted: ObsoleteMarketingContact[];
  errors: (ObsoleteMarketingContact & { error: Error })[];
};

const findObsoleteMarketingContacts = async (
  db: KyselyDb,
): Promise<ObsoleteMarketingContact[]> => {
  const { rows } = await sql<{
    siret: SiretDto;
    obsolete_email: Email;
    is_registered_establishment: boolean;
  }>`
    select
      contacts.siret,
      obsolete.email as obsolete_email,
      exists (
        select 1 from establishments where establishments.siret = contacts.siret
      ) as is_registered_establishment
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

  return rows.map(({ siret, obsolete_email, is_registered_establishment }) => ({
    siret,
    obsoleteEmail: obsolete_email,
    isRegisteredEstablishment: is_registered_establishment,
  }));
};

const keepFirstContactPerEmail = (
  contacts: ObsoleteMarketingContact[],
): ObsoleteMarketingContact[] =>
  contacts.filter(
    (contact, index) =>
      contacts.findIndex(
        ({ obsoleteEmail }) => obsoleteEmail === contact.obsoleteEmail,
      ) === index,
  );

export const deleteOrphanLeadMarketingContacts = async ({
  db,
  establishmentMarketingGateway,
  dryRun,
  includeUnregisteredSirets,
  limit,
}: {
  db: KyselyDb;
  establishmentMarketingGateway: EstablishmentMarketingGateway;
  dryRun: boolean;
  includeUnregisteredSirets: boolean;
  limit?: number;
}): Promise<DeleteOrphanLeadMarketingContactsResult> => {
  const obsoleteContacts = keepFirstContactPerEmail(
    await findObsoleteMarketingContacts(db),
  );

  const candidates = includeUnregisteredSirets
    ? obsoleteContacts
    : obsoleteContacts.filter(
        ({ isRegisteredEstablishment }) => isRegisteredEstablishment,
      );

  const notProcessedForUnregisteredSiret = includeUnregisteredSirets
    ? []
    : obsoleteContacts.filter(
        ({ isRegisteredEstablishment }) => !isRegisteredEstablishment,
      );

  if (dryRun)
    return {
      dryRun,
      candidates,
      notProcessedForUnregisteredSiret,
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
    notProcessedForUnregisteredSiret,
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
        onResponseSideEffect: logPartnerResponses({
          partnerName: partnerNames.brevoEstablishmentMarketing,
        }),
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
        includeUnregisteredSirets: args.includes(
          "--include-unregistered-sirets",
        ),
        limit: limitArg
          ? Number.parseInt(limitArg.replace("--limit=", ""), 10)
          : undefined,
      });
    } finally {
      await pool.end();
    }
  };

const formatSirets = (contacts: ObsoleteMarketingContact[]): string =>
  [
    contacts
      .slice(0, maxSiretsInReport)
      .map(({ siret }) => siret)
      .join(", "),
    contacts.length > maxSiretsInReport
      ? `(and ${contacts.length - maxSiretsInReport} more)`
      : "",
  ]
    .filter((part) => part !== "")
    .join(" ");

if (require.main === module) {
  handleCRONScript({
    name: "deleteOrphanLeadMarketingContacts",
    config,
    script: runScript,
    handleResults: ({
      dryRun,
      candidates,
      notProcessedForUnregisteredSiret,
      deleted,
      errors,
    }) =>
      [
        `Mode: ${dryRun ? "dry run (nothing deleted, use --apply to delete)" : "apply"}`,
        `Obsolete marketing contacts to remove from Brevo: ${candidates.length}`,
        ...(candidates.length > 0 ? [`  ${formatSirets(candidates)}`] : []),
        `Not processed because siret is not a registered establishment (use --include-unregistered-sirets): ${notProcessedForUnregisteredSiret.length}`,
        `Deleted: ${deleted.length}`,
        `Errors: ${errors.length}`,
        ...errors
          .slice(0, maxSiretsInReport)
          .map(({ siret, error }) => `  - ${siret} : ${error.message}`),
      ].join("\n"),
    logger,
  });
}
