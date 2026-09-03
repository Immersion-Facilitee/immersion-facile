import "./instrumentSentryCron";
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
import { createPgUow } from "../domains/core/unit-of-work/adapters/createPgUow";
import { PgUowPerformer } from "../domains/core/unit-of-work/adapters/PgUowPerformer";
import { brevoContactRoutes } from "../domains/marketing/adapters/establishmentMarketingGateway/BrevoContact.routes";
import { BrevoEstablishmentMarketingGateway } from "../domains/marketing/adapters/establishmentMarketingGateway/BrevoEstablishmentMarketingGateway";
import { InMemoryEstablishmentMarketingGateway } from "../domains/marketing/adapters/establishmentMarketingGateway/InMemoryEstablishmentMarketingGateway";
import type { EstablishmentMarketingGateway } from "../domains/marketing/ports/EstablishmentMarketingGateway";
import { makeDeleteEstablishmentMarketingContact } from "../domains/marketing/use-cases/DeleteEstablishmentMarketingContact";
import { makeAxiosInstances } from "../utils/axiosUtils";
import { createLogger } from "../utils/logger";
import { handleCRONScript } from "./handleCRONScript";

const logger = createLogger(__filename);
const config = AppConfig.createFromEnv();

const maxSiretsInReport = 20;

type MarketingContactOfDeletedEstablishment = {
  siret: SiretDto;
  email: Email;
};

export type DeleteMarketingContactsOfDeletedEstablishmentsResult = {
  dryRun: boolean;
  candidates: MarketingContactOfDeletedEstablishment[];
  skippedForEmailSharedWithAnotherSiret: MarketingContactOfDeletedEstablishment[];
  deleted: MarketingContactOfDeletedEstablishment[];
  errors: (MarketingContactOfDeletedEstablishment & { error: Error })[];
};

const findMarketingContactsOfDeletedEstablishments = async (
  db: KyselyDb,
  limit: number | undefined,
): Promise<MarketingContactOfDeletedEstablishment[]> => {
  const query = db
    .selectFrom("marketing_establishment_contacts as contacts")
    .select(["contacts.siret", "contacts.email"])
    .where((eb) =>
      eb.and([
        eb.exists(
          eb
            .selectFrom("establishments_deleted as deletedEstablishments")
            .select("deletedEstablishments.siret")
            .whereRef("deletedEstablishments.siret", "=", "contacts.siret"),
        ),
        eb.not(
          eb.exists(
            eb
              .selectFrom("establishments")
              .select("establishments.siret")
              .whereRef("establishments.siret", "=", "contacts.siret"),
          ),
        ),
      ]),
    )
    .orderBy("contacts.siret");

  return limit === undefined ? query.execute() : query.limit(limit).execute();
};

const findEmailsSharedBySeveralSirets = async (
  db: KyselyDb,
  emails: Email[],
): Promise<Email[]> => {
  if (emails.length === 0) return [];

  const rows = await db
    .selectFrom("marketing_establishment_contacts")
    .select("email")
    .where("email", "in", emails)
    .groupBy("email")
    .having((eb) => eb.fn.count("siret"), ">", 1)
    .execute();

  return rows.map(({ email }) => email);
};

export const deleteMarketingContactsOfDeletedEstablishments = async ({
  db,
  establishmentMarketingGateway,
  dryRun,
  limit,
}: {
  db: KyselyDb;
  establishmentMarketingGateway: EstablishmentMarketingGateway;
  dryRun: boolean;
  limit?: number;
}): Promise<DeleteMarketingContactsOfDeletedEstablishmentsResult> => {
  const candidates = await findMarketingContactsOfDeletedEstablishments(
    db,
    limit,
  );

  const sharedEmails = await findEmailsSharedBySeveralSirets(
    db,
    candidates.map(({ email }) => email),
  );

  const skippedForEmailSharedWithAnotherSiret = candidates.filter(({ email }) =>
    sharedEmails.includes(email),
  );
  const contactsToDelete = candidates.filter(
    ({ email }) => !sharedEmails.includes(email),
  );

  if (dryRun)
    return {
      dryRun,
      candidates,
      skippedForEmailSharedWithAnotherSiret,
      deleted: [],
      errors: [],
    };

  const deleteEstablishmentMarketingContact =
    makeDeleteEstablishmentMarketingContact({
      uowPerformer: new PgUowPerformer(db, createPgUow),
      deps: { establishmentMarketingGateway },
    });

  const results = await executeInSequence(
    contactsToDelete,
    (
      contact,
    ): Promise<
      MarketingContactOfDeletedEstablishment & { error: Error | null }
    > =>
      deleteEstablishmentMarketingContact
        .execute({ siret: contact.siret })
        .then(() => ({ ...contact, error: null }))
        .catch((error) => ({ ...contact, error: castError(error) })),
  );

  return {
    dryRun,
    candidates,
    skippedForEmailSharedWithAnotherSiret,
    deleted: results.flatMap(({ siret, email, error }) =>
      error ? [] : [{ siret, email }],
    ),
    errors: results.flatMap(({ siret, email, error }) =>
      error ? [{ siret, email, error }] : [],
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
  async (): Promise<DeleteMarketingContactsOfDeletedEstablishmentsResult> => {
    const args = process.argv.slice(2);
    const limitArg = args.find((arg) => arg.startsWith("--limit="));

    const pool = createMakeScriptPgPool(config)();

    try {
      return await deleteMarketingContactsOfDeletedEstablishments({
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

const formatSirets = (
  contacts: MarketingContactOfDeletedEstablishment[],
): string =>
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
    name: "deleteMarketingContactsOfDeletedEstablishments",
    config,
    script: runScript,
    handleResults: ({
      dryRun,
      candidates,
      skippedForEmailSharedWithAnotherSiret,
      deleted,
      errors,
    }) =>
      [
        `Mode: ${dryRun ? "dry run (nothing deleted, use --apply to delete)" : "apply"}`,
        `Marketing contacts of deleted establishments found: ${candidates.length}`,
        `Skipped because email is shared with another siret: ${skippedForEmailSharedWithAnotherSiret.length}`,
        ...(skippedForEmailSharedWithAnotherSiret.length > 0
          ? [`  ${formatSirets(skippedForEmailSharedWithAnotherSiret)}`]
          : []),
        `Deleted: ${deleted.length}`,
        `Errors: ${errors.length}`,
        ...errors
          .slice(0, maxSiretsInReport)
          .map(({ siret, error }) => `  - ${siret} : ${error.message}`),
      ].join("\n"),
    logger,
  });
}
