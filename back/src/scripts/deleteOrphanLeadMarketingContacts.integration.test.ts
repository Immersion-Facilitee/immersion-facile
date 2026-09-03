import type { Pool } from "pg";
import { type Email, expectToEqual, type SiretDto, UserBuilder } from "shared";
import { v4 as uuid } from "uuid";
import { type KyselyDb, makeKyselyDb } from "../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../config/pg/pgPool";
import { PgUserRepository } from "../domains/core/authentication/connected-user/adapters/PgUserRepository";
import { PgEstablishmentAggregateRepository } from "../domains/establishment/adapters/PgEstablishmentAggregateRepository";
import type { EstablishmentUserRight } from "../domains/establishment/entities/EstablishmentAggregate";
import { EstablishmentAggregateBuilder } from "../domains/establishment/helpers/EstablishmentBuilders";
import { InMemoryEstablishmentMarketingGateway } from "../domains/marketing/adapters/establishmentMarketingGateway/InMemoryEstablishmentMarketingGateway";
import { PgEstablishmentMarketingRepository } from "../domains/marketing/adapters/PgEstablishmentMarketingRepository";
import { deleteOrphanLeadMarketingContacts } from "./deleteOrphanLeadMarketingContacts";

describe("deleteOrphanLeadMarketingContacts", () => {
  const registeredSiret: SiretDto = "00000000000001";
  const leadSiret: SiretDto = "00000000000002";
  const registeredContactEmail: Email = "establishment-admin@mail.com";
  const obsoleteLeadEmail: Email = "lead-representative@mail.com";

  const establishmentAdmin = new UserBuilder().withId(uuid()).build();
  const establishmentAdminRight: EstablishmentUserRight = {
    role: "establishment-admin",
    status: "ACCEPTED",
    job: "osef",
    phone: "+33600000000",
    userId: establishmentAdmin.id,
    shouldReceiveDiscussionNotifications: true,
    isMainContactByPhone: false,
  };

  let pool: Pool;
  let db: KyselyDb;
  let establishmentMarketingRepository: PgEstablishmentMarketingRepository;
  let establishmentAggregateRepository: PgEstablishmentAggregateRepository;
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
    await db.deleteFrom("establishments__users").execute();
    await db.deleteFrom("immersion_offers").execute();
    await db.deleteFrom("establishments_location_infos").execute();
    await db.deleteFrom("establishments_location_positions").execute();
    await db.deleteFrom("establishments").execute();
    await db.deleteFrom("users").execute();

    establishmentMarketingRepository = new PgEstablishmentMarketingRepository(
      db,
    );
    establishmentAggregateRepository = new PgEstablishmentAggregateRepository(
      db,
    );
    establishmentMarketingGateway = new InMemoryEstablishmentMarketingGateway();

    await new PgUserRepository(db).save(establishmentAdmin);
  });

  const saveMarketingContactWithHistory = async (
    siret: SiretDto,
    currentEmail: Email,
    previousEmails: Email[],
  ) => {
    await establishmentMarketingRepository.save({
      siret,
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
        siret,
        email,
        firstName: "Jean",
        lastName: "Bidule",
        conventions: { numberOfValidatedConvention: 1 },
        hasIcAccount: false,
        isRegistered: false as const,
      })),
    ];
  };

  const saveEstablishment = (siret: SiretDto) =>
    establishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(siret)
        .withUserRights([establishmentAdminRight])
        .build(),
    );

  it("deletes from the gateway the lead email replaced when the establishment got registered with another contact email", async () => {
    await saveMarketingContactWithHistory(
      registeredSiret,
      registeredContactEmail,
      [obsoleteLeadEmail],
    );
    await saveEstablishment(registeredSiret);

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: false,
      includeUnregisteredSirets: false,
    });

    expectToEqual(result.deleted, [
      {
        siret: registeredSiret,
        obsoleteEmail: obsoleteLeadEmail,
        isRegisteredEstablishment: true,
      },
    ]);
    expectToEqual(result.errors, []);
    expectToEqual(
      establishmentMarketingGateway.marketingEstablishments.map(
        ({ email }) => email,
      ),
      [registeredContactEmail],
    );
  });

  it("keeps an obsolete email which is the current contact email of another siret", async () => {
    await saveMarketingContactWithHistory(
      registeredSiret,
      registeredContactEmail,
      [obsoleteLeadEmail],
    );
    await saveEstablishment(registeredSiret);
    await saveMarketingContactWithHistory(leadSiret, obsoleteLeadEmail, []);

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: false,
      includeUnregisteredSirets: false,
    });

    expectToEqual(result.candidates, []);
    expectToEqual(result.deleted, []);
    expectToEqual(
      establishmentMarketingGateway.marketingEstablishments
        .map(({ email }) => email)
        .sort(),
      [registeredContactEmail, obsoleteLeadEmail].sort(),
    );
  });

  it("does not process obsolete emails of a siret which is not a registered establishment, unless asked to", async () => {
    await saveMarketingContactWithHistory(leadSiret, "last-rep@mail.com", [
      obsoleteLeadEmail,
    ]);

    const resultWithoutUnregisteredSirets =
      await deleteOrphanLeadMarketingContacts({
        db,
        establishmentMarketingGateway,
        dryRun: false,
        includeUnregisteredSirets: false,
      });

    expectToEqual(resultWithoutUnregisteredSirets.candidates, []);
    expectToEqual(
      resultWithoutUnregisteredSirets.notProcessedForUnregisteredSiret,
      [
        {
          siret: leadSiret,
          obsoleteEmail: obsoleteLeadEmail,
          isRegisteredEstablishment: false,
        },
      ],
    );

    const resultWithUnregisteredSirets =
      await deleteOrphanLeadMarketingContacts({
        db,
        establishmentMarketingGateway,
        dryRun: false,
        includeUnregisteredSirets: true,
      });

    expectToEqual(resultWithUnregisteredSirets.deleted, [
      {
        siret: leadSiret,
        obsoleteEmail: obsoleteLeadEmail,
        isRegisteredEstablishment: false,
      },
    ]);
    expectToEqual(
      establishmentMarketingGateway.marketingEstablishments.map(
        ({ email }) => email,
      ),
      ["last-rep@mail.com"],
    );
  });

  it("deletes nothing on dry run", async () => {
    await saveMarketingContactWithHistory(
      registeredSiret,
      registeredContactEmail,
      [obsoleteLeadEmail],
    );
    await saveEstablishment(registeredSiret);

    const result = await deleteOrphanLeadMarketingContacts({
      db,
      establishmentMarketingGateway,
      dryRun: true,
      includeUnregisteredSirets: false,
    });

    expectToEqual(result.candidates, [
      {
        siret: registeredSiret,
        obsoleteEmail: obsoleteLeadEmail,
        isRegisteredEstablishment: true,
      },
    ]);
    expectToEqual(result.deleted, []);
    expect(establishmentMarketingGateway.marketingEstablishments.length).toBe(
      2,
    );
  });
});
