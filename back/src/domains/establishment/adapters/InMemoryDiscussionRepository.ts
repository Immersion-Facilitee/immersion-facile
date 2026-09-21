import { isBefore } from "date-fns";
import isAfter from "date-fns/isAfter";
import type {
  DataWithPagination,
  DiscussionDto,
  DiscussionId,
  DiscussionInList,
  SiretDto,
  UserId,
} from "shared";
import type { InMemoryUserRepository } from "../../core/authentication/connected-user/adapters/InMemoryUserRepository";
import type {
  DiscussionRepository,
  GetDiscussionIdsParams,
  GetDiscussionsParams,
  HasDiscussionMatchingParams,
} from "../ports/DiscussionRepository";

type DiscussionsById = Record<DiscussionId, DiscussionDto>;

export class InMemoryDiscussionRepository implements DiscussionRepository {
  constructor(
    private readonly userRepository: InMemoryUserRepository,
    private _discussions: DiscussionsById = {},
  ) {}

  public discussionCallsCount = 0;
  public archivedDiscussionIds: DiscussionId[] = [];

  public async getUserIdsWithNoRecentExchange({
    userIds,
    since,
  }: {
    userIds: UserId[];
    since: Date;
  }): Promise<UserId[]> {
    if (userIds.length === 0) return [];

    const users = this.userRepository.users.filter((user) =>
      userIds.includes(user.id),
    );

    return users
      .filter(
        (user) =>
          !this.discussions.some((discussion) =>
            discussion.exchanges.some(
              (exchange) =>
                exchange.sender === "establishment" &&
                exchange.email === user.email &&
                new Date(exchange.sentAt) >= since,
            ),
          ),
      )
      .map((u) => u.id);
  }

  public async getPaginatedDiscussionsForUser(): Promise<
    DataWithPagination<DiscussionInList>
  > {
    throw new Error("Not implemented");
  }

  public async archiveDiscussions(
    discussionIds: DiscussionId[],
  ): Promise<void> {
    this.discussions = this.discussions.reduce<DiscussionDto[]>(
      (acc, discussion) => [
        ...acc,
        ...(discussionIds.includes(discussion.id) ? [] : [discussion]),
      ],
      [],
    );
    this.archivedDiscussionIds = [
      ...this.archivedDiscussionIds,
      ...discussionIds,
    ];
  }

  public async getDiscussions({
    filters,
    limit,
  }: GetDiscussionsParams): Promise<DiscussionDto[]> {
    this.discussionCallsCount++;
    const discussionFilters: Array<(discussion: DiscussionDto) => boolean> = [
      ({ siret }) =>
        filters.sirets && siret.length > 0
          ? filters.sirets.includes(siret)
          : true,
      ({ createdAt }) =>
        filters.createdSince
          ? new Date(createdAt) >= filters.createdSince
          : true,
      ({ status }) => (filters.status ? status === filters.status : true),
      ({ createdAt }) =>
        filters.createdBetween
          ? new Date(createdAt) >= filters.createdBetween.from &&
            new Date(createdAt) <= filters.createdBetween.to
          : true,
      ({ exchanges }) =>
        filters.answeredByEstablishment !== undefined
          ? exchanges.filter((e) => e.sender === "establishment").length > 0 ===
            filters.answeredByEstablishment
          : true,
      ({ contactMode }) =>
        filters.contactMode !== undefined
          ? contactMode === filters.contactMode
          : true,
    ];
    const discussions = this.discussions
      .filter((discussion) =>
        discussionFilters.every((filter) => filter(discussion)),
      )
      .slice(0, limit);

    return discussions;
  }

  public async getDiscussionIds({
    filters,
    limit,
    orderBy,
  }: GetDiscussionIdsParams): Promise<DiscussionId[]> {
    const discussionFilters: Array<(discussion: DiscussionDto) => boolean> = [
      ({ status }) =>
        filters.statuses && filters.statuses.length > 0
          ? filters.statuses.includes(status)
          : true,
      ({ updatedAt }) =>
        filters.updatedBetween?.from
          ? new Date(updatedAt) >= filters.updatedBetween.from
          : true,
      ({ updatedAt }) =>
        filters.updatedBetween?.to
          ? new Date(updatedAt) <= filters.updatedBetween.to
          : true,
    ];

    return this.discussions
      .filter((discussion) =>
        discussionFilters.every((filter) => filter(discussion)),
      )
      .sort((a, b) => {
        if (orderBy === "updatedAt") return a.updatedAt >= b.updatedAt ? 1 : -1;
        return 0;
      })
      .map(({ id }) => id)
      .slice(0, limit);
  }

  public async countDiscussionsForSiretSince(siret: SiretDto, since: Date) {
    return this.discussions.filter(
      (discussion) =>
        discussion.siret === siret &&
        isAfter(new Date(discussion.createdAt), since),
    ).length;
  }

  public async getById(discussionId: DiscussionId) {
    return this._discussions[discussionId];
  }

  public async hasDiscussionMatching({
    siret,
    appellationCode,
    potentialBeneficiaryEmail,
    since,
  }: Partial<HasDiscussionMatchingParams>): Promise<boolean> {
    const filters = [
      (discussion: DiscussionDto) =>
        siret ? discussion.siret === siret : true,
      (discussion: DiscussionDto) =>
        appellationCode ? discussion.appellationCode === appellationCode : true,
      (discussion: DiscussionDto) =>
        potentialBeneficiaryEmail
          ? discussion.potentialBeneficiary.email === potentialBeneficiaryEmail
          : true,
      (discussion: DiscussionDto) =>
        since ? new Date(discussion.createdAt) >= since : true,
    ];
    return this.discussions.some((discussion) =>
      filters.every((filter) => filter(discussion)),
    );
  }

  public async insert(discussion: DiscussionDto) {
    this._discussions[discussion.id] = discussion;
  }

  public async update(discussion: DiscussionDto) {
    if (!this._discussions[discussion.id])
      throw new Error("Discussion not found");
    this._discussions[discussion.id] = discussion;
  }

  // For test purposes
  public get discussions(): DiscussionDto[] {
    return Object.values(this._discussions);
  }

  public set discussions(discussions: DiscussionDto[]) {
    this._discussions = discussions.reduce(
      (acc, discussion) => ({ ...acc, [discussion.id]: discussion }),
      {} as DiscussionsById,
    );
  }

  public async getObsoleteDiscussions(params: {
    olderThan: Date;
  }): Promise<DiscussionId[]> {
    return Object.values(this._discussions)
      .filter((discussion) =>
        isBefore(new Date(discussion.createdAt), params.olderThan),
      )
      .filter((discussion) => discussion.status === "PENDING")
      .filter((discussion) => discussion.exchanges.length === 1)
      .map((discussion) => discussion.id);
  }
}
