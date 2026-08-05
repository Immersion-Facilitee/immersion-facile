import type {
  AgencyId,
  AppellationCode,
  AssessmentCompletionStatusFilter,
  ConventionDto,
  ConventionId,
  ConventionReadDto,
  ConventionScope,
  ConventionStatus,
  ConventionsWithErroredBroadcastFeedbackFilters,
  ConventionsWithUnfinalizedAssessmentFilters,
  ConventionWithBroadcastFeedback,
  ConventionWithUnfinalizedAssessment,
  DataWithPagination,
  DateFilter,
  DateString,
  Email,
  GetPaginatedConventionsSortBy,
  OptionalDateRange,
  PaginationQueryParams,
  SiretDto,
  UserId,
  WithSort,
} from "shared";

export type GetConventionsFilters = {
  agencyIds?: AgencyId[];
  ids?: ConventionId[];
  startDateGreater?: Date;
  startDateLessOrEqual?: Date;
  dateSubmissionEqual?: Date;
  dateSubmissionSince?: Date;
  endDate?: OptionalDateRange;
  updateDate?: OptionalDateRange;
  withStatuses?: ConventionStatus[];
  withSirets?: SiretDto[];
  withBeneficiary?: {
    email?: Email;
  };
};

export type GetConventionsSortBy = keyof Pick<
  ConventionDto,
  "dateValidation" | "dateStart"
>;

export type GetConventionsParams = {
  filters: GetConventionsFilters;
  sortBy: GetConventionsSortBy;
  limit?: number;
};

export type GetPaginatedConventionsFilters = {
  search?: string;
  statuses?: ConventionStatus[];
  agencyIds?: AgencyId[];
  dateStart?: DateFilter;
  dateEnd?: DateFilter;
  dateSubmission?: DateFilter;
  assessmentCompletionStatus?: AssessmentCompletionStatusFilter[];
};

export type GetPaginatedConventionsParams = {
  filters?: GetPaginatedConventionsFilters;
  sort?: WithSort<GetPaginatedConventionsSortBy>["sort"];
  pagination: Required<PaginationQueryParams>;
};

export type GetConventionIdsParams = {
  filters: {
    withAgencyIds?: AgencyId[];
    withAppelationCodes?: AppellationCode[];
    withDateStart?: OptionalDateRange;
    withDateSubmission?: OptionalDateRange;
    withEndDate?: OptionalDateRange;
    withUpdateDate?: OptionalDateRange;
    withSirets?: SiretDto[];
    withStatuses?: ConventionStatus[];
    withBeneficiary?: {
      birthdate?: DateString;
      email?: Email;
      lastName?: string;
    };
    withEstablishmentRepresentative?: {
      email?: Email;
    };
    withEstablishmentTutor?: {
      email?: Email;
    };
  };
  limit?: number;
};

export interface ConventionQueries {
  getUserIdsWithNoActiveConvention(params: {
    userIds: UserId[];
    since: Date;
  }): Promise<UserId[]>;

  getConventionIdsByFilters(
    params: GetConventionIdsParams,
  ): Promise<ConventionId[]>;

  getConventionById: (id: ConventionId) => Promise<ConventionDto | undefined>;

  getPaginatedConventions(
    params: GetPaginatedConventionsParams,
  ): Promise<DataWithPagination<ConventionDto>>;

  // TODO: a voir si on veut pas à terme unifier en une seule query les 3 queries si dessous
  getConventions(params: GetConventionsParams): Promise<ConventionDto[]>;
  getConventionsByScope(params: {
    scope: ConventionScope;
    limit: number;
    filters: GetConventionsFilters;
  }): Promise<ConventionReadDto[]>;

  getConventionsWithErroredBroadcastFeedbackForAgencyUser(params: {
    userAgencyIds: AgencyId[];
    pagination: PaginationQueryParams;
    filters?: ConventionsWithErroredBroadcastFeedbackFilters;
  }): Promise<DataWithPagination<ConventionWithBroadcastFeedback>>;

  getConventionsWithUnfinalizedAssessmentForAgencyUser(params: {
    userAgencyIds: AgencyId[];
    pagination: Required<PaginationQueryParams>;
    now: Date;
    filters?: ConventionsWithUnfinalizedAssessmentFilters;
  }): Promise<DataWithPagination<ConventionWithUnfinalizedAssessment>>;
}
