import { keys, values } from "ramda";
import {
  type Email,
  errors,
  type GetUsersFilters,
  type UserId,
  type UserWithAdminRights,
  type UserWithNumberOfAgenciesAndEstablishments,
} from "shared";
import type {
  GetUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDeleteParams,
  UserRepository,
} from "../port/UserRepository";

export class InMemoryUserRepository implements UserRepository {
  #usersById: Record<string, UserWithAdminRights> = {};

  public async findByExternalId(
    externalId: string,
  ): Promise<UserWithAdminRights | undefined> {
    return this.users.find(
      (user) => user.proConnect?.externalId === externalId,
    );
  }

  public async findByEmail(
    email: Email,
  ): Promise<UserWithAdminRights | undefined> {
    return this.users.find((user) => user.email === email);
  }

  public async getByIds(userIds: UserId[]): Promise<UserWithAdminRights[]> {
    const users = this.users.filter((user) => userIds.includes(user.id));

    const missingUserIds = userIds.filter(
      (userId) => !users.some((user) => user.id === userId),
    );

    if (missingUserIds.length > 0)
      throw errors.users.notFound({ userIds: missingUserIds });

    return users.sort((a, b) => a.email.localeCompare(b.email));
  }

  public async save(user: UserWithAdminRights): Promise<void> {
    const existingUser = this.#usersById[user.id];
    if (!existingUser) {
      this.#usersById[user.id] = user;
      return usersIntegrityCheck(values(this.#usersById), user);
    }
    if (
      existingUser.firstName === user.firstName &&
      existingUser.lastName === user.lastName &&
      existingUser.email === user.email &&
      existingUser.proConnect?.externalId === user.proConnect?.externalId &&
      existingUser.proConnect?.siret === user.proConnect?.siret &&
      existingUser.preventToDelete === user.preventToDelete
    ) {
      if (user.lastLoginAt) {
        this.#usersById[user.id] = {
          ...existingUser,
          lastLoginAt: user.lastLoginAt,
        };
      }
      return usersIntegrityCheck(values(this.#usersById), user);
    }

    this.#usersById[user.id] = {
      ...existingUser,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      proConnect: user.proConnect
        ? {
            externalId: user.proConnect?.externalId,
            siret: user.proConnect?.siret,
          }
        : null,
      lastLoginAt: user.lastLoginAt,
      preventToDelete: user.preventToDelete,
    };

    return usersIntegrityCheck(values(this.#usersById), user);
  }

  public async delete(id: UserId): Promise<void> {
    const user = this.#usersById[id];
    if (!user) throw errors.user.notFound({ userId: id });

    delete this.#usersById[id];
  }

  // for test purpose
  public get users(): UserWithAdminRights[] {
    return values(this.#usersById);
  }

  public set users(users: UserWithAdminRights[]) {
    this.#usersById = users.reduce<Record<UserId, UserWithAdminRights>>(
      (acc, user) => {
        if (keys(acc).includes(user.id))
          throw errors.user.conflictById({ userId: user.id });
        return {
          ...acc,
          [user.id]: user,
        };
      },
      {},
    );
  }

  public async getById(
    userId: string,
  ): Promise<UserWithAdminRights | undefined> {
    return this.users.find((user) => user.id === userId);
  }

  public async getUsers(
    filters: GetUsersFilters,
  ): Promise<UserWithNumberOfAgenciesAndEstablishments[]> {
    return this.users
      .filter((user) =>
        user.email.toLowerCase().includes(filters.emailContains.toLowerCase()),
      )
      .map((u) => ({
        ...u,
        numberOfAgencies: 404, // no need to implement this
        numberOfEstablishments: 404, // no need to implement this
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  public async updateEmail(userId: UserId, email: string): Promise<void> {
    this.#usersById[userId].email = email;
  }

  async getAllUsers(): Promise<UserWithAdminRights[]> {
    return values(this.#usersById);
  }

  public async getUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDelete({
    since,
    limit,
    offset,
  }: GetUserIdsLoggedInAndCreatedLongAgoAndNotPreventedToDeleteParams): Promise<
    UserId[]
  > {
    return values(this.#usersById)
      .filter((user) =>
        !user.lastLoginAt
          ? new Date(user.createdAt) < since
          : new Date(user.lastLoginAt) < since,
      )
      .filter((user) => !user.preventToDelete)
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(offset, offset + limit)
      .map((u) => u.id);
  }
}

function usersIntegrityCheck(
  users: UserWithAdminRights[],
  userInserted: UserWithAdminRights,
) {
  if (users.filter(({ email }) => email === userInserted.email).length > 1)
    throw errors.user.conflictByEmail({ userEmail: userInserted.email });

  const externalId = userInserted.proConnect?.externalId;
  if (
    externalId &&
    users.filter(({ proConnect }) => proConnect?.externalId === externalId)
      .length > 1
  )
    throw errors.user.conflictByExternalId({ externalId });
}
