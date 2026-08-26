import { subMilliseconds, subYears } from "date-fns";
import type { Pool } from "pg";
import {
  AgencyDtoBuilder,
  errors,
  expectArraysToEqualIgnoringOrder,
  expectPromiseToFailWithError,
  expectToEqual,
  type User,
  type UserId,
  type UserWithAdminRights,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  type KyselyDb,
  makeKyselyDb,
} from "../../../../../config/pg/kysely/kyselyUtils";
import { makeTestPgPool } from "../../../../../config/pg/pgPool";
import { toAgencyWithRights } from "../../../../../utils/agency";
import { PgAgencyRepository } from "../../../../agency/adapters/PgAgencyRepository";
import { PgEstablishmentAggregateRepository } from "../../../../establishment/adapters/PgEstablishmentAggregateRepository";
import { EstablishmentAggregateBuilder } from "../../../../establishment/helpers/EstablishmentBuilders";
import { InMemoryUserRepository } from "./InMemoryUserRepository";
import { fakeProConnectSiret } from "./oauth-gateway/InMemoryOAuthGateway";
import { PgUserRepository } from "./PgUserRepository";

const adapters: ("InMemory" | "Pg")[] = ["Pg", "InMemory"];

describe.each(adapters)("%s UserRepository", (adapter) => {
  const userExternalId = "my-external-id";
  const createdAt = new Date().toISOString();
  const user: User = {
    email: "joe@mail.com",
    lastName: "Doe",
    firstName: "John",
    id: "11111111-1111-1111-1111-111111111111",
    proConnect: {
      externalId: userExternalId,
      siret: fakeProConnectSiret,
    },
    createdAt: createdAt,
    preventToDelete: false,
  };

  const user1: User = {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
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

  const user2: User = {
    id: "44444444-4444-4444-4444-444444444444",
    firstName: "Jane",
    lastName: "Da",
    email: "jane.da@mail.com",
    proConnect: {
      externalId: "jane-external-id",
      siret: fakeProConnectSiret,
    },
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };

  let pool: Pool;
  let db: KyselyDb;
  let userRepository: PgUserRepository | InMemoryUserRepository;

  beforeAll(() => {
    pool = makeTestPgPool();
    db = makeKyselyDb(pool);
  });

  beforeEach(async () => {
    userRepository =
      adapter === "Pg"
        ? new PgUserRepository(db)
        : new InMemoryUserRepository();

    if (adapter === "Pg") {
      await db.deleteFrom("users_ongoing_oauths").execute();
      await db.deleteFrom("convention_drafts").execute();
      await db.deleteFrom("convention_templates").execute();
      await db.deleteFrom("users").execute();
      await db.deleteFrom("users_admins").execute();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe(`With oAuthProvider 'proConnect'`, () => {
    describe("save()", () => {
      it("saves a user, than finds it from external_id, then updates it", async () => {
        await userRepository.save(user);

        const fetchedUser =
          await userRepository.findByExternalId(userExternalId);
        expectToEqual(fetchedUser, user);

        const updatedUser: User = {
          id: user.id,
          email: "updated-mail@mail.com",
          lastName: "Dodo",
          firstName: "Johnny",
          proConnect: {
            externalId: userExternalId,
            siret: fakeProConnectSiret,
          },
          createdAt,
          preventToDelete: false,
        };
        await userRepository.save(updatedUser);

        const fetchedUpdatedUser =
          await userRepository.findByExternalId(userExternalId);
        expectToEqual(fetchedUpdatedUser, updatedUser);
      });

      it("adds the missing data to the entry when user already exists but not connected", async () => {
        const userNotIcConnected: User = {
          ...user,
          firstName: "",
          lastName: "",
        };
        await userRepository.save(userNotIcConnected);
        expectToEqual(await userRepository.getAllUsers(), [userNotIcConnected]);

        await userRepository.save(user);

        expectToEqual(await userRepository.getAllUsers(), [user]);
      });

      it("updates the last_login_at column", async () => {
        await userRepository.save(user);
        expect(
          (await userRepository.getById(user.id))?.lastLoginAt,
        ).toBeUndefined();

        const lastLoginAt = new Date("2025-11-03T10:00:00Z").toISOString();
        await userRepository.save({ ...user, lastLoginAt });
        expectToEqual(await userRepository.getById(user.id), {
          ...user,
          lastLoginAt,
        });
      });

      it("do not update the last_login_at column if not specified", async () => {
        await userRepository.save(user); // creation
        expect(
          (await userRepository.getById(user.id))?.lastLoginAt,
        ).toBeUndefined();

        await userRepository.save(user); // update
        expect(
          (await userRepository.getById(user.id))?.lastLoginAt,
        ).toBeUndefined();
      });
    });

    describe("updateEmail()", () => {
      it("updates users email in users table", async () => {
        await insertUser(userRepository, user1, true);
        const updatedEmail = "new-email@email.fr";

        await userRepository.updateEmail(user1.id, updatedEmail);

        expectToEqual(await userRepository.getById(user1.id), {
          ...user1,
          email: updatedEmail,
        });
      });
    });

    describe("delete()", () => {
      it("deletes an existing user", async () => {
        await insertUser(userRepository, user1, true);
        await userRepository.delete(user1.id);
        const response = await userRepository.getById(user1.id);
        expectToEqual(response, undefined);
        expectToEqual(
          await db
            .selectFrom("users__agencies")
            .selectAll()
            .where("user_id", "=", user1.id)
            .execute(),
          [],
        );
      });

      it("does not throw when user does not exist", async () => {
        await expectPromiseToFailWithError(
          userRepository.delete(user1.id),
          errors.user.notFound({ userId: user1.id }),
        );
      });
    });

    describe("getById()", () => {
      it("gets the connected user from its Id", async () => {
        await insertUser(userRepository, user1, true);

        expectToEqual(await userRepository.getById(user1.id), user1);
      });

      it("gets the connected user with admin right for admins", async () => {
        const adminUser: UserWithAdminRights = {
          ...user1,
          isBackofficeAdmin: true,
        };

        await insertUser(userRepository, adminUser, true);

        if (adapter === "Pg") {
          await db
            .insertInto("users_admins")
            .values({ user_id: adminUser.id })
            .execute();
        }

        expectToEqual(await userRepository.getById(user1.id), {
          ...user1,
          isBackofficeAdmin: true,
        });
      });
    });

    describe("getByIds()", () => {
      it("success nothing", async () => {
        expectToEqual(await userRepository.getByIds([]), []);
      });

      it("success one user", async () => {
        await insertUser(userRepository, user1, true);

        expectToEqual(await userRepository.getByIds([user1.id]), [user1]);
      });

      it("success multiple users", async () => {
        await insertUser(userRepository, user1, true);
        await insertUser(userRepository, user2, true);
        await insertUser(userRepository, user, true);

        expectToEqual(
          await userRepository.getByIds([user1.id, user2.id, user.id]),
          [user2, user, user1],
        );
      });

      it("error if at least one missing user", async () => {
        await insertUser(userRepository, user1, true);

        const missingUserId: UserId = uuid();

        expectPromiseToFailWithError(
          userRepository.getByIds([user1.id, missingUserId]),
          errors.users.notFound({ userIds: [missingUserId] }),
        );
      });

      it("error if multiple missing users", async () => {
        const missingUserId1: UserId = uuid();
        const missingUserId2: UserId = uuid();

        expectPromiseToFailWithError(
          userRepository.getByIds([missingUserId1, missingUserId2]),
          errors.users.notFound({
            userIds: [missingUserId1, missingUserId2],
          }),
        );
      });
    });

    describe("getUsers()", () => {
      it("returns no users when emailContains is empty string", async () => {
        const users = await userRepository.getUsers({ emailContains: "" });
        expectToEqual(users, []);
      });

      it("returns all the users with email matching filter, with no agencies and establishment match", async () => {
        const userNotIcConnected: User = {
          ...user,
          firstName: "",
          lastName: "",
          proConnect: null,
        };

        await insertUser(userRepository, user1, true);
        await insertUser(userRepository, user2, false);
        await insertUser(userRepository, userNotIcConnected, false);

        const withNoAgenciesOrEstablishements = {
          numberOfAgencies: adapter === "Pg" ? 0 : 404,
          numberOfEstablishments: adapter === "Pg" ? 0 : 404,
        };

        expectToEqual(await userRepository.getUsers({ emailContains: "j" }), [
          { ...user2, proConnect: null, ...withNoAgenciesOrEstablishements },
          { ...userNotIcConnected, ...withNoAgenciesOrEstablishements },
          { ...user1, ...withNoAgenciesOrEstablishements },
        ]);
      });

      it("returns user with 1 agency and 1 establishment", async () => {
        await insertUser(userRepository, user1, true);

        if (adapter === "Pg") {
          await db.deleteFrom("conventions").execute();
          await db.deleteFrom("agency_groups__agencies").execute();
          await db.deleteFrom("agencies").execute();
          await db.deleteFrom("establishments").execute();

          const agencyRepository = new PgAgencyRepository(db);
          const agency = new AgencyDtoBuilder().build();

          await agencyRepository.insert(
            toAgencyWithRights(agency, {
              [user1.id]: {
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            }),
          );

          const establishmentRepository =
            new PgEstablishmentAggregateRepository(db);
          const establishmentAggregate = new EstablishmentAggregateBuilder()
            .withEstablishmentSiret("12345678901234")
            .withUserRights([
              {
                role: "establishment-admin",
                job: "Chef",
                userId: user1.id,
                status: "ACCEPTED",
                shouldReceiveDiscussionNotifications: true,
                phone: "+33611223344",
                isMainContactByPhone: false,
                isMainContactInPerson: false,
              },
            ])
            .build();

          const establishmentAggregateWithPendingUser =
            new EstablishmentAggregateBuilder()
              .withEstablishmentSiret("12345678901235")
              .withUserRights([
                {
                  role: "establishment-contact",
                  job: "Sous-chef",
                  userId: user1.id,
                  status: "PENDING",
                  shouldReceiveDiscussionNotifications: true,
                },
              ])
              .withLocationId(uuid())
              .build();

          await establishmentRepository.insertEstablishmentAggregate(
            establishmentAggregate,
          );
          await establishmentRepository.insertEstablishmentAggregate(
            establishmentAggregateWithPendingUser,
          );
        }

        const users = await userRepository.getUsers({ emailContains: "john" });

        expectToEqual(users, [
          {
            ...user1,
            numberOfAgencies: adapter === "Pg" ? 1 : 404,
            numberOfEstablishments: adapter === "Pg" ? 1 : 404,
          },
        ]);
      });
    });

    describe("findByExternalId()", () => {
      it("returns an user", async () => {
        await userRepository.save(user);
        const response = await userRepository.findByExternalId(userExternalId);
        expectToEqual(response, user);
      });

      it("returns undefined when user not found", async () => {
        const response =
          await userRepository.findByExternalId("an-external-id");
        expect(response).toBeUndefined();
      });
    });

    describe("findByEmail()", () => {
      it("returns a user", async () => {
        await userRepository.save(user);
        const response = await userRepository.findByEmail(user.email);
        expectToEqual(response, user);
      });

      it("returns undefined when user not found", async () => {
        const response = await userRepository.findByEmail("some@email.com");
        expect(response).toBeUndefined();
      });
    });
  });

  describe("getUserIdsLoggedInAndCreatedLongAgo()", () => {
    const now = new Date("2026-01-15T10:00:00.000Z");
    const twoYearsAgo = subYears(now, 2);
    const oneYearAgo = subYears(now, 1);
    const threeYearsAgoIso = subYears(now, 3).toISOString();

    const makeUserWithOldLogin = (
      overrides: Partial<UserWithAdminRights> & { id: string; email: string },
    ): UserWithAdminRights => ({
      id: overrides.id,
      email: overrides.email,
      firstName: overrides.firstName ?? "Jean",
      lastName: overrides.lastName ?? "Dupont",
      createdAt:
        overrides.createdAt ??
        new Date("2024-04-28T12:00:00.000Z").toISOString(),
      proConnect: null,
      preventToDelete: overrides.preventToDelete ?? false,
      lastLoginAt: overrides.lastLoginAt,
    });

    it("does not return users prevented to delete", async () => {
      const inactiveUser = makeUserWithOldLogin({
        id: uuid(),
        email: "inactive@test.fr",
        lastLoginAt: threeYearsAgoIso,
      });
      const preventedToDeleteInactiveUser = makeUserWithOldLogin({
        id: uuid(),
        email: "prevented-to-delete@test.fr",
        lastLoginAt: threeYearsAgoIso,
        preventToDelete: true,
      });
      await userRepository.save(inactiveUser);
      await userRepository.save(preventedToDeleteInactiveUser);

      const result =
        await userRepository.getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete(
          {
            since: twoYearsAgo,
            limit: 100,
            offset: 0,
          },
        );

      expectArraysToEqualIgnoringOrder(result, [inactiveUser.id]);
    });

    it("returns users never logged after since param", async () => {
      const logged3yrAgo = makeUserWithOldLogin({
        id: uuid(),
        email: "never-logged@test.fr",
        lastLoginAt: threeYearsAgoIso,
      });
      const recentlyActiveUser = makeUserWithOldLogin({
        id: uuid(),
        email: "recently-active@test.fr",
        lastLoginAt: oneYearAgo.toISOString(),
      });

      await userRepository.save(logged3yrAgo);
      await userRepository.save(recentlyActiveUser);

      const result =
        await userRepository.getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete(
          {
            since: twoYearsAgo,
            limit: 100,
            offset: 0,
          },
        );

      expectArraysToEqualIgnoringOrder(result, [logged3yrAgo.id]);
    });

    it("returns users with old login", async () => {
      const inactiveUser = makeUserWithOldLogin({
        id: uuid(),
        email: "inactive@test.fr",
        lastLoginAt: threeYearsAgoIso,
      });
      const recentlyActiveUser = makeUserWithOldLogin({
        id: uuid(),
        email: "recently-active@test.fr",
        lastLoginAt: oneYearAgo.toISOString(),
      });
      await userRepository.save(inactiveUser);
      await userRepository.save(recentlyActiveUser);

      const result =
        await userRepository.getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete(
          {
            since: twoYearsAgo,
            limit: 100,
            offset: 0,
          },
        );

      expectArraysToEqualIgnoringOrder(result, [inactiveUser.id]);
    });

    it("returns old-login user ids by stable offset pages", async () => {
      const inactiveUserA = makeUserWithOldLogin({
        id: "11111111-1111-4111-9111-111111111111",
        email: "inactive-a@test.fr",
        lastLoginAt: threeYearsAgoIso,
      });
      const inactiveUserB = makeUserWithOldLogin({
        id: "22222222-2222-4222-9222-222222222222",
        email: "inactive-b@test.fr",
        lastLoginAt: threeYearsAgoIso,
      });
      const inactiveUserC = makeUserWithOldLogin({
        id: "33333333-3333-4333-9333-333333333333",
        email: "inactive-c@test.fr",
        lastLoginAt: threeYearsAgoIso,
      });
      await Promise.all([
        userRepository.save(inactiveUserC),
        userRepository.save(inactiveUserA),
        userRepository.save(inactiveUserB),
      ]);

      const firstPage =
        await userRepository.getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete(
          {
            since: twoYearsAgo,
            limit: 2,
            offset: 0,
          },
        );
      const secondPage =
        await userRepository.getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete(
          {
            since: twoYearsAgo,
            limit: 2,
            offset: 2,
          },
        );

      expectToEqual(firstPage, [inactiveUserA.id, inactiveUserB.id]);
      expectToEqual(secondPage, [inactiveUserC.id]);
    });

    it("returns user that are created since expected date", async () => {
      const moreThanTwoYearsAgo = subMilliseconds(twoYearsAgo, 1).toISOString();

      const notLoggedInAndCreatedNow = makeUserWithOldLogin({
        id: "11111111-1111-4111-9111-111111111111",
        email: "created-now@test.fr",
        lastLoginAt: undefined,
        createdAt: now.toISOString(),
      });
      const loggedInNowAndCreatedMoreThan2YrAgo = makeUserWithOldLogin({
        id: "33333333-3333-4333-9333-333333333333",
        email: "active-now@test.fr",
        createdAt: twoYearsAgo.toISOString(),
        lastLoginAt: now.toISOString(),
      });
      const notLoggedInAndCreatedMoreThan2YrAgo = makeUserWithOldLogin({
        id: "22222222-2222-4222-9222-222222222222",
        email: "inactive-not-loggedin@test.fr",
        lastLoginAt: undefined,
        createdAt: moreThanTwoYearsAgo,
      });
      const loggedInAndCreatedMoreThan2YrAgo = makeUserWithOldLogin({
        id: "44444444-4444-4444-4444-444444444444",
        email: "inactive-@test.fr",
        createdAt: moreThanTwoYearsAgo,
        lastLoginAt: moreThanTwoYearsAgo,
      });
      await Promise.all([
        userRepository.save(loggedInNowAndCreatedMoreThan2YrAgo),
        userRepository.save(notLoggedInAndCreatedNow),
        userRepository.save(notLoggedInAndCreatedMoreThan2YrAgo),
        userRepository.save(loggedInAndCreatedMoreThan2YrAgo),
      ]);

      const firstPage =
        await userRepository.getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete(
          {
            since: twoYearsAgo,
            limit: 2,
            offset: 0,
          },
        );
      const secondPage =
        await userRepository.getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete(
          {
            since: twoYearsAgo,
            limit: 1,
            offset: 1,
          },
        );

      expectToEqual(firstPage, [
        notLoggedInAndCreatedMoreThan2YrAgo.id,
        loggedInAndCreatedMoreThan2YrAgo.id,
      ]);
      expectToEqual(secondPage, [loggedInAndCreatedMoreThan2YrAgo.id]);
    });
  });
});

const insertUser = async (
  userRepository: PgUserRepository | InMemoryUserRepository,
  user: UserWithAdminRights,
  isProConnected: boolean,
) => {
  await userRepository.save({
    ...user,
    proConnect: isProConnected ? user.proConnect : null,
  });
};
