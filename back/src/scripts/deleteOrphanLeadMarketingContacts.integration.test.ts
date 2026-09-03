import type { Pool } from "pg";
import { type Email, expectToEqual, type SiretDto } from "shared";
import { type KyselyDb, makeKyselyDb } from "../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../config/pg/pgPool";
import { InMemoryEstablishmentMarketingGateway } from "../domains/marketing/adapters/establishmentMarketingGateway/InMemoryEstablishmentMarketingGateway";
import { PgEstablishmentMarketingRepository } from "../domains/marketing/adapters/PgEstablishmentMarketingRepository";
import { deleteOrphanLeadMarketingContacts } from "./deleteOrphanLeadMarketingContacts";

describe("deleteOrphanLeadMarketingContacts", () => {
  const siret: SiretDto = "00000000000001";
  const otherSiret: SiretDto = "00000000000002";
  const currentContactEmail: Email = "current-contact@mail.com";
  const obsoleteEmail: Email = "former-representative@mail.com";

  let pool: Pool;
  let db: KyselyDb;
  let establishmentMarketingRepository: PgEstablishmentMarketingRepository;
  let establishmentMarketingGateway: InMemoryEstablishmentMarketingGateway;

  beforeAll(() => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await db.deleteFrom("marketing_establishment_contacts").execute();

    establishmentMarketingRepository = new PgEstablishmentMarketingRepository(
      db,
    );
    establishmentMarketingGateway = new InMemoryEstablishmentMarketingGateway();
  });

  const saveMarketingContactWithHistory = async (
    contactSiret: SiretDto,
    currentEmail: Email,
    previousEmails: Email[],
  ) => {
    await establishmentMarketingRepository.save({
      siret: contactSiret,
      contactEmail: currentEmail,
      nafCode: null,
      emailContactHistory: [currentEmail, ...previousEmails].map(
        (email, index) => ({
          email,
          firstName: "Jean",
          lastName: "Bidule",
          createdAt: new Date(2024, index, 1),
        }),
      ),
    });

    establishmentMarketingGateway.marketingEstablishments = [
      ...establishmentMarketingGateway.marketingEstablishments,
      ...[currentEmail, ...previousEmails].map((email) => ({
        siret: contactSiret,
        email,
        firstName: "Jean",
        lastName: "Bidule",
        conventions: { numberOfValidatedConvention: 1 },
        hasIcAccount: false,
        isRegistered: false as const,
      })),
    ];
  };

  it("deletes from Brevo an obsolete email present only in a contact history", async () => {
    await saveMarketingContactWithHistory(siret, currentContactEmail, [
      obsoleteEmail,
    ]);

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.deleted, [{ siret, obsoleteEmail }]);
    expectToEqual(result.errors, []);
    expectToEqual(
      establishmentMarketingGateway.marketingEstablishments.map(
        ({ email }) => email,
      ),
      [currentContactEmail],
    );
  });

  it("keeps an obsolete email which is the current contact email of another siret", async () => {
    await saveMarketingContactWithHistory(siret, currentContactEmail, [
      obsoleteEmail,
    ]);
    await saveMarketingContactWithHistory(otherSiret, obsoleteEmail, []);

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.candidates, []);
    expectToEqual(result.deleted, []);
    expectToEqual(
      establishmentMarketingGateway.marketingEstablishments
        .map(({ email }) => email)
        .sort(),
      [currentContactEmail, obsoleteEmail].sort(),
    );
  });

  it("deletes nothing on dry run", async () => {
    await saveMarketingContactWithHistory(siret, currentContactEmail, [
      obsoleteEmail,
    ]);

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: true,
    });

    expectToEqual(result.candidates, [{ siret, obsoleteEmail }]);
    expectToEqual(result.deleted, []);
    expect(establishmentMarketingGateway.marketingEstablishments.length).toBe(
      2,
    );
  });
});
