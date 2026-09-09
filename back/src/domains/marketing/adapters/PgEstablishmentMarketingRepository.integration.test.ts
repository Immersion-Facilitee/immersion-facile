import type { Pool } from "pg";
import { expectToEqual } from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../config/pg/pgPool";
import type { MarketingContact } from "../entities/MarketingContact";
import type { EstablishmentMarketingContactEntity } from "../ports/EstablishmentMarketingRepository";
import { PgEstablishmentMarketingRepository } from "./PgEstablishmentMarketingRepository";

describe("PgAgencyRepository", () => {
  let pool: Pool;
  let db: KyselyDb;
  let establishmentMarketingRepository: PgEstablishmentMarketingRepository;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await db.deleteFrom("marketing_establishment_contacts").execute();
    establishmentMarketingRepository = new PgEstablishmentMarketingRepository(
      makeKyselyDb(pool),
    );
  });

  it("getBySiret & save add/update & delete", async () => {
    const establishmentMarketingContact: EstablishmentMarketingContactEntity = {
      contactEmail: "jean-bidule@gmail.com",
      siret: "11112222333344",
      nafCode: "0111Z",
      emailContactHistory: [
        {
          email: "jean-bidule@gmail.com",
          firstName: "Jean",
          lastName: "Bidule",
          createdAt: new Date(),
        },
      ],
    };

    expect(
      await establishmentMarketingRepository.getBySiret(
        establishmentMarketingContact.siret,
      ),
    ).toBeUndefined();

    await establishmentMarketingRepository.save(establishmentMarketingContact);

    expectToEqual(
      await establishmentMarketingRepository.getBySiret(
        establishmentMarketingContact.siret,
      ),
      establishmentMarketingContact,
    );

    const newContact: MarketingContact = {
      createdAt: new Date(),
      email: "other@mail.com",
      firstName: "Charles",
      lastName: "Maltais",
    };

    const updatedEstablishmentMarketingContact: EstablishmentMarketingContactEntity =
      {
        contactEmail: newContact.email,
        nafCode: "1910Z",
        emailContactHistory: [
          newContact,
          ...establishmentMarketingContact.emailContactHistory,
        ],
        siret: establishmentMarketingContact.siret,
      };

    await establishmentMarketingRepository.save(
      updatedEstablishmentMarketingContact,
    );

    expectToEqual(
      await establishmentMarketingRepository.getBySiret(
        updatedEstablishmentMarketingContact.siret,
      ),
      updatedEstablishmentMarketingContact,
    );

    await establishmentMarketingRepository.delete(
      updatedEstablishmentMarketingContact.siret,
    );

    expectToEqual(
      await establishmentMarketingRepository.getBySiret(
        updatedEstablishmentMarketingContact.siret,
      ),
      undefined,
    );
  });

  it("getSiretsByContactEmail returns every siret currently using the email as contact email", async () => {
    const sharedEmail = "shared-contact@gmail.com";
    const makeContact = (
      siret: string,
      contactEmail: string,
    ): EstablishmentMarketingContactEntity => ({
      contactEmail,
      siret,
      nafCode: "0111Z",
      emailContactHistory: [
        {
          email: contactEmail,
          firstName: "Jean",
          lastName: "Bidule",
          createdAt: new Date(),
        },
      ],
    });

    await establishmentMarketingRepository.save(
      makeContact("11112222333344", sharedEmail),
    );
    await establishmentMarketingRepository.save(
      makeContact("55556666777788", sharedEmail),
    );
    await establishmentMarketingRepository.save(
      makeContact("99990000111122", "other-contact@gmail.com"),
    );

    expectToEqual(
      await establishmentMarketingRepository.getSiretsByContactEmail(
        sharedEmail,
      ),
      ["11112222333344", "55556666777788"],
    );

    expectToEqual(
      await establishmentMarketingRepository.getSiretsByContactEmail(
        "unknown-contact@gmail.com",
      ),
      [],
    );
  });
});
