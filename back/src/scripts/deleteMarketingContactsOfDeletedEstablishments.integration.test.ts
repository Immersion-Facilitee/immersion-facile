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
import type { EstablishmentMarketingGatewayDto } from "../domains/marketing/ports/EstablishmentMarketingGateway";
import type { EstablishmentMarketingContactEntity } from "../domains/marketing/ports/EstablishmentMarketingRepository";
import { deleteMarketingContactsOfDeletedEstablishments } from "./deleteMarketingContactsOfDeletedEstablishments";

describe("deleteMarketingContactsOfDeletedEstablishments", () => {
  const deletedEstablishmentSiret: SiretDto = "00000000000001";
  const deletedEstablishmentEmail: Email = "deleted@mail.com";
  const registeredEstablishmentSiret: SiretDto = "00000000000002";
  const registeredEstablishmentEmail: Email = "registered@mail.com";
  const leadSiret: SiretDto = "00000000000003";
  const leadEmail: Email = "lead@mail.com";
  const secondDeletedEstablishmentSiret: SiretDto = "00000000000004";
  const secondDeletedEstablishmentEmail: Email = "deleted-2@mail.com";

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
    await db.deleteFrom("convention_templates").execute();
    await db.deleteFrom("conventions").execute();
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
    const marketingContact: EstablishmentMarketingContactEntity = {
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
    };
    const marketingEstablishment: EstablishmentMarketingGatewayDto = {
      siret,
      email,
      firstName: "Jean",
      lastName: "Bidule",
      conventions: { numberOfValidatedConvention: 1 },
      hasIcAccount: false,
      isRegistered: false,
    };

    await establishmentMarketingRepository.save(marketingContact);
    establishmentMarketingGateway.marketingEstablishments = [
      ...establishmentMarketingGateway.marketingEstablishments,
      marketingEstablishment,
    ];

    return { marketingContact, marketingEstablishment };
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
    expectToEqual(
      await establishmentMarketingRepository.getBySiret(
        deletedEstablishmentSiret,
      ),
      undefined,
    );
    expectToEqual(establishmentMarketingGateway.marketingEstablishments, []);
  });

  it("keeps the marketing contact of a siret which has been registered again after deletion", async () => {
    const { marketingContact, marketingEstablishment } =
      await saveMarketingContact(
        registeredEstablishmentSiret,
        registeredEstablishmentEmail,
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
    expectToEqual(
      await establishmentMarketingRepository.getBySiret(
        registeredEstablishmentSiret,
      ),
      marketingContact,
    );
    expectToEqual(establishmentMarketingGateway.marketingEstablishments, [
      marketingEstablishment,
    ]);
  });

  it("keeps the marketing contact of a lead, which has never been a registered establishment", async () => {
    const { marketingContact, marketingEstablishment } =
      await saveMarketingContact(leadSiret, leadEmail);

    const result = await deleteMarketingContactsOfDeletedEstablishments({
      db,
      establishmentMarketingGateway,
      dryRun: false,
    });

    expectToEqual(result.candidates, []);
    expectToEqual(result.deleted, []);
    expectToEqual(
      await establishmentMarketingRepository.getBySiret(leadSiret),
      marketingContact,
    );
    expectToEqual(establishmentMarketingGateway.marketingEstablishments, [
      marketingEstablishment,
    ]);
  });

  it("skips the marketing contact when its email is shared with another siret", async () => {
    const sharedEmail: Email = "shared@mail.com";
    const { marketingContact: deletedEstablishmentMarketingContact } =
      await saveMarketingContact(deletedEstablishmentSiret, sharedEmail);
    await saveDeletedEstablishment(deletedEstablishmentSiret);
    const { marketingEstablishment: leadMarketingEstablishment } =
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
    expectToEqual(
      await establishmentMarketingRepository.getBySiret(
        deletedEstablishmentSiret,
      ),
      deletedEstablishmentMarketingContact,
    );
    expectToEqual(establishmentMarketingGateway.marketingEstablishments, [
      leadMarketingEstablishment,
    ]);
  });

  it("deletes nothing on dry run", async () => {
    const { marketingContact, marketingEstablishment } =
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
    expectToEqual(
      await establishmentMarketingRepository.getBySiret(
        deletedEstablishmentSiret,
      ),
      marketingContact,
    );
    expectToEqual(establishmentMarketingGateway.marketingEstablishments, [
      marketingEstablishment,
    ]);
  });

  it("caps the number of processed contacts to the given limit", async () => {
    await saveMarketingContact(
      deletedEstablishmentSiret,
      deletedEstablishmentEmail,
    );
    await saveDeletedEstablishment(deletedEstablishmentSiret);
    const {
      marketingContact: secondDeletedEstablishmentMarketingContact,
      marketingEstablishment: secondDeletedEstablishmentMarketingEstablishment,
    } = await saveMarketingContact(
      secondDeletedEstablishmentSiret,
      secondDeletedEstablishmentEmail,
    );
    await saveDeletedEstablishment(secondDeletedEstablishmentSiret);

    const result = await deleteMarketingContactsOfDeletedEstablishments({
      db,
      establishmentMarketingGateway,
      dryRun: false,
      limit: 1,
    });

    expectToEqual(result.candidates, [
      { siret: deletedEstablishmentSiret, email: deletedEstablishmentEmail },
    ]);
    expectToEqual(result.deleted, [
      { siret: deletedEstablishmentSiret, email: deletedEstablishmentEmail },
    ]);
    expectToEqual(
      await establishmentMarketingRepository.getBySiret(
        secondDeletedEstablishmentSiret,
      ),
      secondDeletedEstablishmentMarketingContact,
    );
    expectToEqual(establishmentMarketingGateway.marketingEstablishments, [
      secondDeletedEstablishmentMarketingEstablishment,
    ]);
  });
});
