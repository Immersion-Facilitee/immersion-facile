import type { Pool } from "pg";
import { expectToEqual, type User } from "shared";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../../config/pg/pgPool";
import type { OngoingOAuth } from "../entities/OngoingOAuth";
import { fakeProConnectSiret } from "./oauth-gateway/InMemoryOAuthGateway";
import { PgOngoingOAuthRepository } from "./PgOngoingOAuthRepository";
import { PgUserRepository } from "./PgUserRepository";

describe("PgOngoingOAuthRepository", () => {
  let pool: Pool;
  let pgOngoingOAuthRepository: PgOngoingOAuthRepository;
  let pgUserRepository: PgUserRepository;
  let db: KyselyDb;

  beforeAll(async () => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
    pgOngoingOAuthRepository = new PgOngoingOAuthRepository(db);
    pgUserRepository = new PgUserRepository(db);
  });

  const state = "11111111-1111-1111-1111-111111111111";
  const ongoingOAuth: OngoingOAuth = {
    fromUri: "/uriWithSome?queryParam1=yeah&param2=haaaannnnnnnnn",
    state,
    nonce: "123",
    provider: "proConnect",
    usedAt: null,
    idToken: null,
  };
  const user: User = {
    id: "22222222-2222-2222-2222-222222222222",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@mail.com",
    proConnect: {
      externalId: "john-external-id",
      siret: fakeProConnectSiret,
    },
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };

  beforeEach(async () => {
    await db.deleteFrom("convention_templates").execute();
    await db.deleteFrom("users_ongoing_oauths").execute();
    await db.deleteFrom("users").execute();
    await pgUserRepository.save(user);
    await pgOngoingOAuthRepository.save(ongoingOAuth);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("with provider 'proConnect'", () => {
    it("saves an ongoing OAuth, then gets it from its states, then updates it, than gets ongoingOauth from userId", async () => {
      const fetchedFromState =
        await pgOngoingOAuthRepository.findByState(state);
      expectToEqual(fetchedFromState, ongoingOAuth);

      const results = await db
        .selectFrom("users_ongoing_oauths")
        .selectAll()
        .execute();
      expect(results).toHaveLength(1);

      await pgUserRepository.save(user);
      const updatedOngoingOAuth: OngoingOAuth = {
        ...ongoingOAuth,
        userId: user.id,
        externalId: user.proConnect?.externalId,
        accessToken: "some-token",
      };
      await pgOngoingOAuthRepository.save(updatedOngoingOAuth);

      const fetchedFromUserId = await pgOngoingOAuthRepository.findByUserId(
        user.id,
      );
      expectToEqual(fetchedFromUserId, updatedOngoingOAuth);
    });

    it("also saves the date of use and the email when it is of kind email", async () => {
      const state = "22222222-2222-2222-2222-222222222222";
      const ongoingOAuth: OngoingOAuth = {
        fromUri: "/uri",
        state,
        nonce: "444",
        provider: "email",
        email: "bob@mail.com",
        usedAt: null,
      };
      await pgOngoingOAuthRepository.save(ongoingOAuth);

      const fetchedFromState =
        await pgOngoingOAuthRepository.findByState(state);

      expectToEqual(fetchedFromState, ongoingOAuth);

      const updatedOngoingOAuth: OngoingOAuth = {
        ...ongoingOAuth,
        userId: user.id,
        usedAt: new Date(),
      };
      await pgOngoingOAuthRepository.save(updatedOngoingOAuth);
      const fetchedFromUserId = await pgOngoingOAuthRepository.findByUserId(
        user.id,
      );
      expectToEqual(fetchedFromUserId, {
        ...updatedOngoingOAuth,
        email: ongoingOAuth.email,
      });
    });
  });

  describe("deleteOldOngoingOauths", () => {
    it("does nothing if no ongoing oauths to delete", async () => {
      const numberOfOngoingOauthsDeleted =
        await pgOngoingOAuthRepository.deleteOldOngoingOauths(
          new Date("2025-05-01"),
        );

      expectToEqual(numberOfOngoingOauthsDeleted, 0);
    });

    it("deletes old ongoing oauths", async () => {
      await pgUserRepository.save(user);
      const oldOngoingOAuth: OngoingOAuth = {
        ...ongoingOAuth,
        userId: user.id,
        externalId: user.proConnect?.externalId,
        accessToken: "some-token",
        updatedAt: new Date("2024-01-01"),
      };
      const recentOngoingOAuth: OngoingOAuth = {
        ...ongoingOAuth,
        state: "22222222-2222-2222-2222-222222222222",
        userId: user.id,
        externalId: user.proConnect?.externalId,
        accessToken: "some-token",
        updatedAt: new Date("2025-10-01"),
      };
      await pgOngoingOAuthRepository.save(oldOngoingOAuth);
      await pgOngoingOAuthRepository.save(recentOngoingOAuth);

      const numberOfOngoingOauthsDeleted =
        await pgOngoingOAuthRepository.deleteOldOngoingOauths(
          new Date("2025-05-01"),
        );

      expectToEqual(numberOfOngoingOauthsDeleted, 1);
      const fetchedFromUserId = await pgOngoingOAuthRepository.findByUserId(
        user.id,
      );
      expectToEqual(fetchedFromUserId, {
        ...recentOngoingOAuth,
        updatedAt: undefined,
      });
    });
  });
});
