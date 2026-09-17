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
  const otherCurrentContactEmail: Email = "other-current-contact@mail.com";
  const obsoleteEmail: Email = "former-representative@mail.com";
  const secondObsoleteEmail: Email = "old-manager@mail.com";

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

  const saveMarketingContactWithHistory = async ({
    contactSiret,
    currentEmail,
    previousEmails,
  }: {
    contactSiret: SiretDto;
    currentEmail: Email;
    previousEmails: Email[];
  }) => {
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

  const saveMarketingContactWithMixedCaseHistory = async ({
    contactSiret,
    currentEmail,
    historyEmails,
  }: {
    contactSiret: SiretDto;
    currentEmail: Email;
    historyEmails: string[];
  }) => {
    await establishmentMarketingRepository.save({
      siret: contactSiret,
      contactEmail: currentEmail,
      nafCode: null,
      emailContactHistory: historyEmails.map((email, index) => ({
        email,
        firstName: "Jean",
        lastName: "Bidule",
        createdAt: new Date(2024, index, 1),
      })),
    });

    establishmentMarketingGateway.marketingEstablishments = [
      ...establishmentMarketingGateway.marketingEstablishments,
      {
        siret: contactSiret,
        email: currentEmail,
        firstName: "Jean",
        lastName: "Bidule",
        conventions: { numberOfValidatedConvention: 1 },
        hasIcAccount: false,
        isRegistered: false as const,
      },
    ];
  };

  it("deletes from Brevo an obsolete email present only in a contact history", async () => {
    await saveMarketingContactWithHistory({
      contactSiret: siret,
      currentEmail: currentContactEmail,
      previousEmails: [obsoleteEmail],
    });

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
    await saveMarketingContactWithHistory({
      contactSiret: siret,
      currentEmail: currentContactEmail,
      previousEmails: [obsoleteEmail],
    });
    await saveMarketingContactWithHistory({
      contactSiret: otherSiret,
      currentEmail: obsoleteEmail,
      previousEmails: [],
    });

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

  it("keeps a history email which only differs by case from the current contact email", async () => {
    await saveMarketingContactWithMixedCaseHistory({
      contactSiret: siret,
      currentEmail: currentContactEmail,
      historyEmails: ["Current-Contact@Mail.com"],
    });

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.candidates, []);
    expectToEqual(result.deleted, []);
    expectToEqual(
      establishmentMarketingGateway.marketingEstablishments.map(
        ({ email }) => email,
      ),
      [currentContactEmail],
    );
  });

  it("deletes nothing on dry run", async () => {
    await saveMarketingContactWithHistory({
      contactSiret: siret,
      currentEmail: currentContactEmail,
      previousEmails: [obsoleteEmail],
    });

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

  it("deletes an obsolete email only once when it appears in the history of several sirets", async () => {
    await saveMarketingContactWithHistory({
      contactSiret: siret,
      currentEmail: currentContactEmail,
      previousEmails: [obsoleteEmail],
    });
    await saveMarketingContactWithHistory({
      contactSiret: otherSiret,
      currentEmail: otherCurrentContactEmail,
      previousEmails: [obsoleteEmail],
    });

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.candidates, [{ siret, obsoleteEmail }]);
    expectToEqual(result.deleted, [{ siret, obsoleteEmail }]);
    expectToEqual(result.errors, []);
    expectToEqual(
      establishmentMarketingGateway.marketingEstablishments
        .map(({ email }) => email)
        .sort(),
      [currentContactEmail, otherCurrentContactEmail].sort(),
    );
  });

  it("deletes several obsolete emails present in a single contact history", async () => {
    await saveMarketingContactWithHistory({
      contactSiret: siret,
      currentEmail: currentContactEmail,
      previousEmails: [obsoleteEmail, secondObsoleteEmail],
    });

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.deleted, [
      { siret, obsoleteEmail },
      { siret, obsoleteEmail: secondObsoleteEmail },
    ]);
    expectToEqual(result.errors, []);
    expectToEqual(
      establishmentMarketingGateway.marketingEstablishments.map(
        ({ email }) => email,
      ),
      [currentContactEmail],
    );
  });

  it("caps the number of deletions to the given limit but still reports every candidate", async () => {
    await saveMarketingContactWithHistory({
      contactSiret: siret,
      currentEmail: currentContactEmail,
      previousEmails: [obsoleteEmail, secondObsoleteEmail],
    });

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: false,
      limit: 1,
    });

    expectToEqual(result.candidates, [
      { siret, obsoleteEmail },
      { siret, obsoleteEmail: secondObsoleteEmail },
    ]);
    expectToEqual(result.deleted, [{ siret, obsoleteEmail }]);
    expectToEqual(
      establishmentMarketingGateway.marketingEstablishments
        .map(({ email }) => email)
        .sort(),
      [currentContactEmail, secondObsoleteEmail].sort(),
    );
  });
});
