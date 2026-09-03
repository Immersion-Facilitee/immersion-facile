import type { Pool } from "pg";
import { type Email, expectToEqual, type SiretDto, UserBuilder } from "shared";
import { v4 as uuid } from "uuid";
import { type KyselyDb, makeKyselyDb } from "../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../config/pg/pgPool";
import { PgUserRepository } from "../domains/core/authentication/connected-user/adapters/PgUserRepository";
import { PgDeletedEstablishmentRepository } from "../domains/establishment/adapters/PgDeletedEstablishmentRepository";
import { PgEstablishmentAggregateRepository } from "../domains/establishment/adapters/PgEstablishmentAggregateRepository";
import type { EstablishmentUserRight } from "../domains/establishment/entities/EstablishmentAggregate";
import { EstablishmentAggregateBuilder } from "../domains/establishment/helpers/EstablishmentBuilders";
import { InMemoryEstablishmentMarketingGateway } from "../domains/marketing/adapters/establishmentMarketingGateway/InMemoryEstablishmentMarketingGateway";
import { PgEstablishmentMarketingRepository } from "../domains/marketing/adapters/PgEstablishmentMarketingRepository";
import { deleteMarketingContactsOfDeletedEstablishments } from "./deleteMarketingContactsOfDeletedEstablishments";

describe("deleteMarketingContactsOfDeletedEstablishments", () => {
  const deletedEstablishmentSiret: SiretDto = "00000000000001";
  const deletedEstablishmentEmail: Email = "deleted@mail.com";
  const registeredEstablishmentSiret: SiretDto = "00000000000002";
  const leadSiret: SiretDto = "00000000000003";

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
  let deletedEstablishmentRepository: PgDeletedEstablishmentRepository;
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
    await db.deleteFrom("establishments_deleted").execute();
    await db.deleteFrom("establishments__users").execute();
    await db.deleteFrom("immersion_offers").execute();
    await db.deleteFrom("establishments_location_infos").execute();
    await db.deleteFrom("establishments_location_positions").execute();
    await db.deleteFrom("establishments").execute();
    await db.deleteFrom("users").execute();

    establishmentMarketingRepository = new PgEstablishmentMarketingRepository(
      db,
    );
    deletedEstablishmentRepository = new PgDeletedEstablishmentRepository(db);
    establishmentAggregateRepository = new PgEstablishmentAggregateRepository(
      db,
    );
    establishmentMarketingGateway = new InMemoryEstablishmentMarketingGateway();

    await new PgUserRepository(db).save(establishmentAdmin);
  });

  const saveMarketingContact = async (siret: SiretDto, email: Email) => {
    await establishmentMarketingRepository.save({
      siret,
      contactEmail: email,
      nafCode: null,
      emailContactHistory: [
        {
          email,
          firstName: "Jean",
          lastName: "Bidule",
          createdAt: new Date("2024-01-01"),
        },
      ],
    });
    establishmentMarketingGateway.marketingEstablishments = [
      ...establishmentMarketingGateway.marketingEstablishments,
      {
        siret,
        email,
        firstName: "Jean",
        lastName: "Bidule",
        conventions: { numberOfValidatedConvention: 1 },
        hasIcAccount: false,
        isRegistered: false,
      },
    ];
  };

  const saveDeletedEstablishment = (siret: SiretDto) =>
    deletedEstablishmentRepository.save({
      siret,
      createdAt: new Date("2024-01-01"),
      deletedAt: new Date("2024-06-01"),
    });

  const saveEstablishment = (siret: SiretDto) =>
    establishmentAggregateRepository.insertEstablishmentAggregate(
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(siret)
        .withUserRights([establishmentAdminRight])
        .build(),
    );

  it("deletes the marketing contact of a deleted establishment, from repository and gateway", async () => {
    await saveMarketingContact(
      deletedEstablishmentSiret,
      deletedEstablishmentEmail,
    );
    await saveDeletedEstablishment(deletedEstablishmentSiret);

    const result = await deleteMarketingContactsOfDeletedEstablishments({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.deleted, [
      { siret: deletedEstablishmentSiret, email: deletedEstablishmentEmail },
    ]);
    expectToEqual(result.errors, []);
    expect(
      await establishmentMarketingRepository.getBySiret(
        deletedEstablishmentSiret,
      ),
    ).toBeUndefined();
    expectToEqual(establishmentMarketingGateway.marketingEstablishments, []);
  });

  it("keeps the marketing contact of a siret which has been registered again after deletion", async () => {
    await saveMarketingContact(
      registeredEstablishmentSiret,
      "registered@mail.com",
    );
    await saveDeletedEstablishment(registeredEstablishmentSiret);
    await saveEstablishment(registeredEstablishmentSiret);

    const result = await deleteMarketingContactsOfDeletedEstablishments({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.candidates, []);
    expectToEqual(result.deleted, []);
    expect(
      await establishmentMarketingRepository.getBySiret(
        registeredEstablishmentSiret,
      ),
    ).toBeDefined();
  });

  it("keeps the marketing contact of a lead, which has never been a registered establishment", async () => {
    await saveMarketingContact(leadSiret, "lead@mail.com");

    const result = await deleteMarketingContactsOfDeletedEstablishments({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.candidates, []);
    expectToEqual(result.deleted, []);
    expect(
      await establishmentMarketingRepository.getBySiret(leadSiret),
    ).toBeDefined();
  });

  it("skips the marketing contact when its email is shared with another siret", async () => {
    const sharedEmail: Email = "shared@mail.com";
    await saveMarketingContact(deletedEstablishmentSiret, sharedEmail);
    await saveDeletedEstablishment(deletedEstablishmentSiret);
    await saveMarketingContact(leadSiret, sharedEmail);

    const result = await deleteMarketingContactsOfDeletedEstablishments({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.skippedForEmailSharedWithAnotherSiret, [
      { siret: deletedEstablishmentSiret, email: sharedEmail },
    ]);
    expectToEqual(result.deleted, []);
    expect(
      await establishmentMarketingRepository.getBySiret(
        deletedEstablishmentSiret,
      ),
    ).toBeDefined();
    expect(establishmentMarketingGateway.marketingEstablishments.length).toBe(
      1,
    );
  });

  it("deletes nothing on dry run", async () => {
    await saveMarketingContact(
      deletedEstablishmentSiret,
      deletedEstablishmentEmail,
    );
    await saveDeletedEstablishment(deletedEstablishmentSiret);

    const result = await deleteMarketingContactsOfDeletedEstablishments({
      db,
      establishmentMarketingGateway,
      dryRun: true,
    });

    expectToEqual(result.candidates, [
      { siret: deletedEstablishmentSiret, email: deletedEstablishmentEmail },
    ]);
    expectToEqual(result.deleted, []);
    expect(
      await establishmentMarketingRepository.getBySiret(
        deletedEstablishmentSiret,
      ),
    ).toBeDefined();
    expect(establishmentMarketingGateway.marketingEstablishments.length).toBe(
      1,
    );
  });
});
