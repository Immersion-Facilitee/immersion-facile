import type {
  AgencyId,
  ApiConsumerName,
  AppellationCode,
  AssessmentCompletionStatusFilter,
  ConventionDto,
  ConventionId,
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

export type OmitStatusesForAgenciesFilter = {
  agencyIds: AgencyId[];
  statuses: ConventionStatus[];
};

export type EstablishmentUserAccessFilter = {
  sirets: SiretDto[];
  email: Email;
};

export type GetPaginatedConventionsFilters = {
  search?: string;
  statuses?: ConventionStatus[];
  agencyIds?: AgencyId[];
  omitStatusesForAgencies?: OmitStatusesForAgenciesFilter;
  dateStart?: DateFilter;
  dateEnd?: DateFilter;
  dateSubmission?: DateFilter;
  assessmentCompletionStatus?: AssessmentCompletionStatusFilter[];
  beneficiaryEmail?: Email;
  establishmentUserAccess?: EstablishmentUserAccessFilter;
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
    withValidationDate?: OptionalDateRange;
    withSirets?: SiretDto[];
    withStatuses?: ConventionStatus[];
    withEmail?: Email;
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

export type GetConventionsWithErroredBroadcastFeedbackForAgencyUserParams = {
  userAgencyIds: AgencyId[];
  pagination: Required<PaginationQueryParams>;
  filters?: ConventionsWithErroredBroadcastFeedbackFilters;
  relevantConsumerNamesByAgencyId: Record<AgencyId, ApiConsumerName[]>;
};

export interface ConventionQueries {
  getConventionIdsByFilters(
    params: GetConventionIdsParams,
  ): Promise<ConventionId[]>;

  getConventionById: (id: ConventionId) => Promise<ConventionDto | undefined>;

  getPaginatedConventions(
    params: GetPaginatedConventionsParams,
  ): Promise<DataWithPagination<ConventionDto>>;

  getConventions(params: GetConventionsParams): Promise<ConventionDto[]>;

  getConventionsWithErroredBroadcastFeedbackForAgencyUser(
    params: GetConventionsWithErroredBroadcastFeedbackForAgencyUserParams,
  ): Promise<DataWithPagination<ConventionWithBroadcastFeedback>>;

  getConventionsWithUnfinalizedAssessmentForAgencyUser(params: {
    userAgencyIds: AgencyId[];
    pagination: Required<PaginationQueryParams>;
    now: Date;
    filters?: ConventionsWithUnfinalizedAssessmentFilters;
  }): Promise<DataWithPagination<ConventionWithUnfinalizedAssessment>>;
}
