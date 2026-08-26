import { type SqlBool, sql } from "kysely";
import {
  type Email,
  errors,
  type GetUsersFilters,
  isTruthy,
  type SiretDto,
  type User,
  type UserId,
  type UserWithAdminRights,
  type UserWithNumberOfAgenciesAndEstablishments,
} from "shared";
import {
  isInArray,
  type KyselyDb,
} from "../../../../../config/pg/kysely/kyselyUtils";
import type {
  GetUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDeleteParams,
  UserRepository,
} from "../port/UserRepository";

type PersistenceAuthenticatedUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  external_id: string | null;
  siret: SiretDto | null;
  created_at: string;
  isBackofficeAdmin: SqlBool;
  last_login_at: string | null;
  prevent_to_delete: boolean;
};

export class PgUserRepository implements UserRepository {
  constructor(private transaction: KyselyDb) {}

  //For testing purpose
  public async getAllUsers(): Promise<UserWithAdminRights[]> {
    const allUsers = await this.#getUserQueryBuilder().execute();
    return allUsers
      .map((userInDb) => this.#toAuthenticatedUser(userInDb))
      .filter(isTruthy);
  }

  public async delete(userId: UserId): Promise<void> {
    const response = await this.transaction
      .deleteFrom("users")
      .where("id", "=", userId)
      .returning("id")
      .executeTakeFirst();

    if (!response)
      throw errors.user.notFound({
        userId,
      });
  }

  public async save(user: UserWithAdminRights): Promise<void> {
    const {
      id,
      email,
      firstName,
      lastName,
      createdAt,
      proConnect,
      lastLoginAt,
      preventToDelete,
    } = user;

    const existingUser = await this.#findById(id);

    if (!existingUser) {
      await this.transaction
        .insertInto("users")
        .values({
          id,
          email,
          first_name: firstName,
          last_name: lastName,
          pro_connect_sub: proConnect?.externalId,
          pro_connect_siret: proConnect?.siret,
          created_at: createdAt,
          last_login_at: lastLoginAt ? sql`${lastLoginAt}` : sql`NULL`,
          prevent_to_delete: preventToDelete,
        })
        .execute();
      return;
    }

    if (
      existingUser.firstName === firstName &&
      existingUser.lastName === lastName &&
      existingUser.email === email &&
      existingUser.proConnect?.externalId === proConnect?.externalId &&
      existingUser.proConnect?.siret === proConnect?.siret &&
      existingUser.preventToDelete === preventToDelete
    ) {
      if (lastLoginAt) {
        await this.transaction
          .updateTable("users")
          .set({ last_login_at: sql`${lastLoginAt}` })
          .where("id", "=", id)
          .execute();
      }
      return;
    }

    await this.transaction
      .updateTable("users")
      .set({
        first_name: firstName,
        last_name: lastName,
        email,
        pro_connect_sub: proConnect?.externalId,
        pro_connect_siret: proConnect?.siret,
        updated_at: sql`now()`,
        ...(lastLoginAt ? { last_login_at: sql`${lastLoginAt}` } : {}),
        prevent_to_delete: preventToDelete,
      })
      .where("id", "=", id)
      .execute();
    return;
  }

  public async updateEmail(userId: string, email: string): Promise<void> {
    await this.transaction
      .updateTable("users")
      .set({
        email,
        updated_at: sql`now()`,
      })
      .where("id", "=", userId)
      .execute();
  }

  public async getById(
    userId: UserId,
  ): Promise<UserWithAdminRights | undefined> {
    const user = await this.#getUserQueryBuilder()
      .where("id", "=", userId)
      .executeTakeFirst();

    return this.#toAuthenticatedUser(user);
  }

  async getByIds(userIds: UserId[]): Promise<UserWithAdminRights[]> {
    if (!userIds.length) return [];
    const usersInDb = await this.#getUserQueryBuilder()
      .where((eb) => isInArray(eb, "users.id", userIds))
      .execute();
    const users = usersInDb
      .map((userInDb) => this.#toAuthenticatedUser(userInDb))
      .filter(isTruthy);
    const missingUserIds = userIds.filter(
      (userId) => !users.some(({ id }) => id === userId),
    );
    if (missingUserIds.length)
      throw errors.users.notFound({ userIds: missingUserIds });
    return users;
  }

  public async getUsers(
    filters: GetUsersFilters,
  ): Promise<UserWithNumberOfAgenciesAndEstablishments[]> {
    if (filters.emailContains === "") return [];
    const usersInDb = await this.transaction
      .selectFrom("users")
      .leftJoin("users__agencies", "users.id", "users__agencies.user_id")
      .leftJoin(
        "establishments__users",
        "users.id",
        "establishments__users.user_id",
      )
      .select((eb) => [
        "users.id as id",
        "users.email as email",
        sql<string>`${eb.ref("users.first_name")}`.as("firstName"),
        sql<string>`${eb.ref("users.last_name")}`.as("lastName"),
        sql<string>`date_to_iso(${eb.ref("users.created_at")})`.as("createdAt"),
        sql<{ externalId: string; siret: SiretDto } | null>`
          CASE
            WHEN ${eb.ref("pro_connect_sub")} IS NOT NULL AND ${eb.ref("pro_connect_siret")} IS NOT NULL
            THEN jsonb_build_object('externalId', ${eb.ref("pro_connect_sub")}, 'siret', ${eb.ref("pro_connect_siret")})
            ELSE NULL
          END
        `.as("proConnect"),
        sql<boolean>`${eb.ref("users.prevent_to_delete")}`.as(
          "preventToDelete",
        ),
        sql<number>`COUNT(DISTINCT ${eb.ref("users__agencies.agency_id")})::int`.as(
          "numberOfAgencies",
        ),
        sql<number>`COUNT(DISTINCT CASE WHEN ${eb.ref("establishments__users.status")} = 'ACCEPTED' THEN ${eb.ref("establishments__users.siret")} END)::int`.as(
          "numberOfEstablishments",
        ),
      ])
      .where("users.email", "like", `%${filters.emailContains.toLowerCase()}%`)
      .groupBy("users.id")
      .orderBy("users.email")
      .limit(50)
      .execute();
    return usersInDb;
  }

  public async getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete({
    since,
    limit,
    offset,
  }: GetUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDeleteParams): Promise<
    UserId[]
  > {
    const rows = await this.transaction
      .selectFrom("users")
      .select("users.id")
      .where(({ eb, or, and }) =>
        or([
          eb("users.last_login_at", "<", since),
          and([
            eb("users.last_login_at", "is", null),
            eb("users.created_at", "<", since.toISOString()),
          ]),
        ]),
      )
      .where("users.prevent_to_delete", "=", false)
      .orderBy("users.id")
      .limit(limit)
      .offset(offset)
      .execute();

    return rows.map((r) => r.id);
  }

  public async findByExternalId(
    externalId: string,
  ): Promise<UserWithAdminRights | undefined> {
    const response = await this.#getUserQueryBuilder()
      .where("pro_connect_sub", "=", externalId)
      .executeTakeFirst();
    return this.#toAuthenticatedUser(response);
  }

  public async findByEmail(email: Email): Promise<User | undefined> {
    const response = await this.#getUserQueryBuilder()
      .where("users.email", "=", email.toLowerCase())
      .executeTakeFirst();
    return this.#toAuthenticatedUser(response);
  }

  async #findById(userId: UserId): Promise<UserWithAdminRights | undefined> {
    const response = await this.#getUserQueryBuilder()
      .where("id", "=", userId)
      .executeTakeFirst();
    return this.#toAuthenticatedUser(response);
  }

  #getUserQueryBuilder() {
    return this.transaction
      .selectFrom("users")
      .leftJoin("users_admins", "users.id", "users_admins.user_id")
      .select([
        "users.id as id",
        "users.email as email",
        "users.first_name as first_name",
        "users.last_name as last_name",
        (qb) =>
          sql<string>`date_to_iso(${qb.ref("users.created_at")})`.as(
            "created_at",
          ),
        "pro_connect_sub as external_id",
        "pro_connect_siret as siret",
        sql<SqlBool>`BOOL_OR(users_admins.user_id IS NOT NULL)`.as(
          "isBackofficeAdmin",
        ),
        (qb) =>
          sql<string>`date_to_iso(${qb.ref("users.last_login_at")})`.as(
            "last_login_at",
          ),
        "users.prevent_to_delete as prevent_to_delete",
      ])
      .groupBy("users.id")
      .orderBy("users.email");
  }

  #toAuthenticatedUser(
    raw?: PersistenceAuthenticatedUser,
  ): UserWithAdminRights | undefined {
    return (
      raw && {
        id: raw.id,
        email: raw.email,
        firstName: raw.first_name,
        lastName: raw.last_name,
        proConnect:
          raw.external_id && raw.siret
            ? {
                externalId: raw.external_id,
                siret: raw.siret,
              }
            : null,
        ...(raw.isBackofficeAdmin === true ? { isBackofficeAdmin: true } : {}),
        createdAt: new Date(raw.created_at).toISOString(),
        lastLoginAt: raw.last_login_at
          ? new Date(raw.last_login_at).toISOString()
          : undefined,
        preventToDelete: raw.prevent_to_delete,
      }
    );
  }
}
