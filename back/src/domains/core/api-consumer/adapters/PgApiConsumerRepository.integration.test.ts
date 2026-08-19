import type { Pool } from "pg";
import {
  type ApiConsumer,
  expectArraysToEqualIgnoringOrder,
  expectToEqual,
  type WebhookSubscription,
} from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../config/pg/pgPool";
import { phoneNumberExist } from "../../phone-number/adapters/pgPhoneHelper";
import { UuidV4Generator } from "../../uuid-generator/adapters/UuidGeneratorImplementations";
import { PgApiConsumerRepository } from "./PgApiConsumerRepository";

const apiConsumer: ApiConsumer = {
  id: new UuidV4Generator().new(),
  name: "passeEmploi",
  description: "my description",
  contact: {
    firstName: "john",
    lastName: "doe",
    emails: ["email@mail.com"],
    job: "job",
    phone: "+33644889977",
  },
  createdAt: new Date().toISOString(),
  expirationDate: new Date().toISOString(),
  revokedAt: null,
  currentKeyIssuedAt: new Date().toISOString(),
  rights: {
    searchEstablishment: {
      kinds: ["READ"],
      scope: "no-scope",
      subscriptions: [],
    },
    convention: {
      kinds: ["READ"],
      scope: {
        agencyKinds: [],
      },
      subscriptions: [],
    },
    statistics: {
      kinds: ["READ"],
      scope: "no-scope",
      subscriptions: [],
    },
  },
};

describe("PgApiConsumerRepository", () => {
  let pool: Pool;
  let db: KyselyDb;
  let apiConsumerRepository: PgApiConsumerRepository;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
    apiConsumerRepository = new PgApiConsumerRepository(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await db.deleteFrom("api_consumers").execute();
  });

  it("save & getById", async () => {
    expectToEqual(
      await apiConsumerRepository.getById(apiConsumer.id),
      undefined,
    );

    await apiConsumerRepository.save(apiConsumer);
    expectToEqual(
      await apiConsumerRepository.getById(apiConsumer.id),
      apiConsumer,
    );

    const updatedApiConsumer: ApiConsumer = {
      id: apiConsumer.id,
      name: "passeEmploiupdated",
      contact: {
        firstName: "john 5",
        lastName: "manson",
        emails: ["john-v@mail.com"],
        job: "guitariste",
        phone: "+33606660666",
      },
      createdAt: new Date().toISOString(),
      expirationDate: new Date().toISOString(),
      revokedAt: null,
      currentKeyIssuedAt: new Date().toISOString(),
      rights: {
        searchEstablishment: {
          kinds: ["READ"],
          scope: "no-scope",
          subscriptions: [],
        },
        convention: {
          kinds: ["READ"],
          scope: {
            agencyKinds: [],
          },
          subscriptions: [],
        },
        statistics: {
          kinds: ["READ"],
          scope: "no-scope",
          subscriptions: [],
        },
      },
    };

    await apiConsumerRepository.save(updatedApiConsumer);
    expectToEqual(
      await apiConsumerRepository.getById(apiConsumer.id),
      updatedApiConsumer,
    );

    expect(await phoneNumberExist(db, apiConsumer.contact.phone)).toBe(true);
  });

  describe("getByFilters", () => {
    const agencyId = new UuidV4Generator().new();
    const apiConsumerWithAgencyIdRight: ApiConsumer = {
      ...apiConsumer,
      id: new UuidV4Generator().new(),
      name: "passeEmploiWithAgencyIdRight",
      rights: {
        ...apiConsumer.rights,
        convention: {
          kinds: ["READ"],
          scope: {
            agencyIds: [agencyId],
          },
          subscriptions: [],
        },
      },
    };
    const apiConsumerWithAgencyKindRight: ApiConsumer = {
      ...apiConsumer,
      id: new UuidV4Generator().new(),
      name: "passeEmploiWithAgencyIdRight",
      rights: {
        ...apiConsumer.rights,
        convention: {
          kinds: ["READ"],
          scope: {
            agencyKinds: ["cci"],
          },
          subscriptions: [],
        },
      },
    };

    beforeEach(async () => {
      await apiConsumerRepository.save(apiConsumer);
      await apiConsumerRepository.save(apiConsumerWithAgencyIdRight);
      await apiConsumerRepository.save(apiConsumerWithAgencyKindRight);
    });

    it("returns all api consumers when no filters are provided", async () => {
      await apiConsumerRepository.save(apiConsumer);

      expectArraysToEqualIgnoringOrder(
        await apiConsumerRepository.getByFilters({}),
        [
          apiConsumerWithAgencyKindRight,
          apiConsumerWithAgencyIdRight,
          apiConsumer,
        ],
      );
    });

    describe("with agencyIds filters", () => {
      it("returns api consumers matching agencyIds filter", async () => {
        expectToEqual(
          await apiConsumerRepository.getByFilters({
            agencyIds: [agencyId],
          }),
          [apiConsumerWithAgencyIdRight],
        );
      });

      it("returns empty array when no api consumers matching agencyIds filter", async () => {
        expectToEqual(
          await apiConsumerRepository.getByFilters({
            agencyIds: [new UuidV4Generator().new()],
          }),
          [],
        );
      });

      it("returns all api consumers when agencyIds filter is empty", async () => {
        expectArraysToEqualIgnoringOrder(
          await apiConsumerRepository.getByFilters({
            agencyIds: [],
          }),
          [
            apiConsumer,
            apiConsumerWithAgencyIdRight,
            apiConsumerWithAgencyKindRight,
          ],
        );
      });
    });

    describe("with agencyKinds filters", () => {
      it("returns api consumers matching agencyKinds filter", async () => {
        expectToEqual(
          await apiConsumerRepository.getByFilters({
            agencyKinds: ["cci"],
          }),
          [apiConsumerWithAgencyKindRight],
        );
      });

      it("returns empty array when no api consumers matching agencyKinds filter", async () => {
        expectToEqual(
          await apiConsumerRepository.getByFilters({
            agencyKinds: ["france-travail"],
          }),
          [],
        );
      });

      it("returns all api consumers when agencyKinds filter is empty", async () => {
        expectArraysToEqualIgnoringOrder(
          await apiConsumerRepository.getByFilters({
            agencyKinds: [],
          }),
          [
            apiConsumer,
            apiConsumerWithAgencyIdRight,
            apiConsumerWithAgencyKindRight,
          ],
        );
      });
    });

    describe("with multiple filters", () => {
      it("returns api consumers matching agencyIds and agencyKinds filters", async () => {
        expectArraysToEqualIgnoringOrder(
          await apiConsumerRepository.getByFilters({
            agencyIds: [agencyId],
            agencyKinds: ["cci"],
          }),
          [apiConsumerWithAgencyIdRight, apiConsumerWithAgencyKindRight],
        );
      });

      it("returns empty array when no api consumers matching agencyIds filter", async () => {
        expectToEqual(
          await apiConsumerRepository.getByFilters({
            agencyIds: [new UuidV4Generator().new()],
            agencyKinds: ["france-travail"],
          }),
          [],
        );
      });
    });
  });

  describe("getAll", () => {
    it("returns empty array when no consumers found", async () => {
      expectToEqual(await apiConsumerRepository.getAll(), []);
    });

    it("returns all api consumers", async () => {
      await apiConsumerRepository.save(apiConsumer);
      expectToEqual(await apiConsumerRepository.getAll(), [apiConsumer]);
    });
  });

  describe("addSubscription", () => {
    it("add first subscription", async () => {
      expect(apiConsumer.rights.convention.subscriptions).toEqual([]);
      await apiConsumerRepository.save(apiConsumer);

      const subscription: WebhookSubscription = {
        callbackUrl: "https://partner-callback-url",
        callbackHeaders: {
          authorization: "my-cb-auth-header",
          "X-Gravitee-Api-Key": "gravitee",
        },
        subscribedEvent: "convention.updated",
        createdAt: new Date().toISOString(),
        id: new UuidV4Generator().new(),
      };

      const updatedConsumer: ApiConsumer = {
        ...apiConsumer,
        rights: {
          ...apiConsumer.rights,
          convention: {
            ...apiConsumer.rights.convention,
            subscriptions: [subscription],
          },
        },
      };

      await apiConsumerRepository.save(updatedConsumer);

      const updatedConsumerInRepo = await apiConsumerRepository.getById(
        updatedConsumer.id,
      );
      expectToEqual(updatedConsumerInRepo, updatedConsumer);
    });
  });
});
