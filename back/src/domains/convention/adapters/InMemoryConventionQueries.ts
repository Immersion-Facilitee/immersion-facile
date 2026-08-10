import { addDays, isAfter, isBefore, subDays, subMonths } from "date-fns";
import { propEq, toPairs } from "ramda";
import {
  type AgencyId,
  ASSESSEMENT_SIGNATURE_RELEASE_DATE,
  type ConventionDto,
  type ConventionId,
  type ConventionReadDto,
  type ConventionScope,
  type ConventionsWithErroredBroadcastFeedbackFilters,
  type ConventionsWithUnfinalizedAssessmentFilters,
  type ConventionWithBroadcastFeedback,
  type ConventionWithUnfinalizedAssessment,
  calculatePaginationResult,
  conventionSchema,
  conventionStatusesDemonstratingUserActivity,
  type DataWithPagination,
  type DateFilter,
  errors,
  type GetPaginatedConventionsSortBy,
  isConventionEndingInOneDayOrMore,
  isFunctionalBroadcastFeedbackError,
  isUnvalidatedConventionStatus,
  makeEmptyLastReminders,
  NotFoundError,
  type PaginationQueryParams,
  type SiretDto,
  type UserId,
  type WithBannedEstablishmentInformations,
  type WithSort,
} from "shared";
import { match } from "ts-pattern";
import { validateAndParseZodSchema } from "../../../config/helpers/validateAndParseZodSchema";
import { assesmentEntityToConventionAssessmentFields } from "../../../utils/convention";
import { createLogger } from "../../../utils/logger";
import type { InMemoryAgencyRepository } from "../../agency/adapters/InMemoryAgencyRepository";
import type { InMemoryUserRepository } from "../../core/authentication/connected-user/adapters/InMemoryUserRepository";
import type { InMemoryBroadcastFeedbacksRepository } from "../../core/saved-errors/adapters/InMemoryBroadcastFeedbacksRepository";
import type { InMemoryBannedEstablishmentRepository } from "../../establishment/adapters/InMemoryBannedEstablishmentRepository";
import type { BannedEstablishment } from "../../establishment/ports/BannedEstablishmentRepository";
import type { AssessmentEntity } from "../entities/AssessmentEntity";
import type {
  ConventionQueries,
  GetConventionIdsParams,
  GetConventionsFilters,
  GetConventionsParams,
  GetPaginatedConventionsFilters,
  GetPaginatedConventionsParams,
} from "../ports/ConventionQueries";
import type { InMemoryAssessmentRepository } from "./InMemoryAssessmentRepository";
import type { InMemoryConventionRepository } from "./InMemoryConventionRepository";
import { hasEmptyArrayFilter } from "./pgConventionSql";

const logger = createLogger(__filename);

export class InMemoryConventionQueries implements ConventionQueries {
  constructor(
    private readonly conventionRepository: InMemoryConventionRepository,
    private readonly agencyRepository: InMemoryAgencyRepository,
    private readonly userRepository: InMemoryUserRepository,
    private readonly assessmentRepository: InMemoryAssessmentRepository,
    private readonly broadcastFeedbacksRepository: InMemoryBroadcastFeedbacksRepository,
    private readonly bannedEstablishmentRepository: InMemoryBannedEstablishmentRepository,
  ) {}

  public async getUserIdsWithNoActiveConvention({
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
          !this.conventionRepository.conventions.some((convention) => {
            if (new Date(convention.dateEnd) < since) return false;
            if (
              !conventionStatusesDemonstratingUserActivity.includes(
                convention.status,
              )
            )
              return false;
            const conventionEmails = [
              convention.signatories.beneficiary.email,
              convention.establishmentTutor.email,
              convention.signatories.establishmentRepresentative.email,
              convention.signatories.beneficiaryRepresentative?.email,
              convention.signatories.beneficiaryCurrentEmployer?.email,
            ].filter(Boolean);
            return conventionEmails.includes(user.email);
          }),
      )
      .map((u) => u.id);
  }

  public async getConventionIdsByFilters(
    params: GetConventionIdsParams,
  ): Promise<ConventionId[]> {
    const results = this.conventionRepository.conventions
      .filter(makeApplyFiltersToGetConventionIds(params.filters))
      .map((convention) => convention.id);

    return params.limit ? results.slice(0, params.limit) : results;
  }

  public async getConventionById(
    id: ConventionId,
  ): Promise<ConventionDto | undefined> {
    const convention = this.conventionRepository.conventions.find(
      propEq(id, "id"),
    );
    if (!convention) return;

    return validateAndParseZodSchema({
      schemaName: "conventionSchema",
      inputSchema: conventionSchema,
      schemaParsingInput: convention,
      id: convention.id,
      logger,
    });
  }

  public getConventionsByFiltersCalled = 0;

  public async getConventions({
    filters,
    sortBy,
  }: GetConventionsParams): Promise<ConventionDto[]> {
    this.getConventionsByFiltersCalled++;

    return this.conventionRepository.conventions
      .filter(makeApplyFiltersToConventions(filters))
      .sort((previous, current) => {
        const previousDate = previous[sortBy];
        const currentDate = current[sortBy];

        if (!previousDate) return 1;
        if (!currentDate) return -1;

        return (
          new Date(currentDate).getTime() - new Date(previousDate).getTime()
        );
      })
      .map((convention) =>
        validateAndParseZodSchema({
          schemaName: "conventionSchema",
          inputSchema: conventionSchema,
          schemaParsingInput: convention,
          id: convention.id,
          logger,
        }),
      );
  }

  public async getPaginatedConventions({
    filters = {},
    pagination,
    sort,
  }: GetPaginatedConventionsParams): Promise<
    DataWithPagination<ConventionDto>
  > {
    if (hasEmptyArrayFilter(filters))
      return {
        data: [],
        pagination: calculatePaginationResult({
          ...pagination,
          totalRecords: 0,
        }),
      };

    const filteredConventions = this.conventionRepository.conventions.filter(
      makeApplyPaginatedFiltersToConventions(filters),
    );

    const withAssessmentFilter = filters.assessmentCompletionStatus?.length
      ? filteredConventions.filter(
          makeApplyAssessmentCompletionStatusFilter(
            filters,
            this.assessmentRepository.assessments,
          ),
        )
      : filteredConventions;

    const sortedConventions = sortConventionsInMemory(
      withAssessmentFilter,
      sort,
    );

    const { page, perPage } = pagination;
    const startIndex = (page - 1) * perPage;

    return {
      data: sortedConventions.slice(startIndex, startIndex + perPage),
      pagination: calculatePaginationResult({
        ...pagination,
        totalRecords: sortedConventions.length,
      }),
    };
  }

  public async getConventionsByScope(params: {
    scope: ConventionScope;
    limit: number;
    filters: GetConventionsFilters;
  }): Promise<ConventionReadDto[]> {
    return await Promise.all(
      this.conventionRepository.conventions
        .filter((convention) => {
          //TODO : dépendance agency repo dans convention repo à gérer plutot dans le usecase pour garder le repo convention indépendant
          const agency = this.agencyRepository.agencies.find(
            (agency) => agency.id === convention.agencyId,
          );

          if (!agency) throw new NotFoundError("agency not found");

          return (
            params.scope.agencyKinds?.includes(agency.kind) ||
            params.scope.agencyIds?.includes(agency.id)
          );
        })
        .filter(makeApplyFiltersToConventions(params.filters))
        .map((convention) =>
          this.#addAgencyAndAssessmentDataToConvention(convention),
        ),
    );
  }

  public async getLatestConventionBySirets(
    sirets: SiretDto[],
  ): Promise<ConventionReadDto[]> {
    const conventionReadDtos = await Promise.all(
      this.conventionRepository.conventions
        .filter(
          (conventionDto) =>
            sirets?.includes(conventionDto.siret) &&
            !!conventionDto.dateValidation,
        )
        .map((conventionDto) =>
          this.#addAgencyAndAssessmentDataToConvention(conventionDto),
        ),
    );

    const latestConventionsBySiret = conventionReadDtos.reduce(
      (acc: Record<SiretDto, ConventionReadDto>, conventionReadDto) => {
        const dateFromCurrentConvention =
          acc[conventionReadDto.siret]?.dateValidation;
        const dateFromIncomingConvention = conventionReadDto.dateValidation;

        if (
          !acc[conventionReadDto.siret] ||
          (dateFromCurrentConvention &&
            dateFromIncomingConvention &&
            isBefore(
              new Date(dateFromCurrentConvention),
              new Date(dateFromIncomingConvention),
            ))
        )
          return {
            ...acc,
            [conventionReadDto.siret]: conventionReadDto,
          };

        return acc;
      },
      {},
    );

    return Object.values(latestConventionsBySiret);
  }

  #addAgencyAndAssessmentDataToConvention = async (
    convention: ConventionDto,
  ): Promise<ConventionReadDto> => {
    const bannedEstablishment: BannedEstablishment | undefined =
      await this.bannedEstablishmentRepository.getBannedEstablishmentBySiret(
        convention.siret,
      );

    const withBannedEstablishmentInformations: WithBannedEstablishmentInformations =
      bannedEstablishment
        ? {
            isEstablishmentBanned: true,
            establishmentBannishmentJustification:
              bannedEstablishment.establishmentBannishmentJustification,
          }
        : { isEstablishmentBanned: false };

    const agency = this.agencyRepository.agencies.find(
      (agency) => agency.id === convention.agencyId,
    );

    if (!agency)
      throw errors.agency.notFound({ agencyId: convention.agencyId });

    const referedAgency =
      agency.refersToAgencyId &&
      this.agencyRepository.agencies.find(
        (agency) => agency.id === agency.refersToAgencyId,
      );

    const counsellorIds = toPairs(agency.usersRights).reduce<UserId[]>(
      (acc, [userId, userRights]) => [
        ...acc,
        ...(userRights?.roles.includes("counsellor") ? [userId] : []),
      ],
      [],
    );

    const assessment = this.assessmentRepository.assessments.find(
      (assessment) => assessment.conventionId === convention.id,
    );

    return {
      ...convention,
      agencyName: agency.name,
      agencyDepartment: agency.address.departmentCode,
      agencyContactEmail: agency.contactEmail,
      agencyKind: agency.kind,
      agencySiret: agency.agencySiret,
      agencyValidationSteps: counsellorIds.length
        ? "counsellor-and-validator"
        : "validator-only",
      agencyRefersTo: referedAgency
        ? {
            id: referedAgency.id,
            name: referedAgency.name,
            contactEmail: referedAgency.contactEmail,
            kind: referedAgency.kind,
            siret: referedAgency.agencySiret,
          }
        : undefined,
      ...assesmentEntityToConventionAssessmentFields(assessment),
      lastReminders: makeEmptyLastReminders(),
      ...withBannedEstablishmentInformations,
    };
  };

  public async getConventionsWithUnfinalizedAssessmentForAgencyUser({
    userAgencyIds,
    pagination,
    now,
    filters = {},
  }: {
    userAgencyIds: AgencyId[];
    pagination: Required<PaginationQueryParams>;
    now: Date;
    filters?: ConventionsWithUnfinalizedAssessmentFilters;
  }): Promise<DataWithPagination<ConventionWithUnfinalizedAssessment>> {
    if (userAgencyIds.length === 0)
      return {
        data: [],
        pagination: {
          totalRecords: 0,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 0,
        },
      };

    const { assessmentCompletionStatus } = filters;

    const threeMonthsAgo = subMonths(now, 3);
    const twoDaysAgo = subDays(now, 2);
    const signatureReleaseThreshold = addDays(
      ASSESSEMENT_SIGNATURE_RELEASE_DATE,
      1,
    );

    const conventionsForUser = this.conventionRepository.conventions
      .filter((convention) => userAgencyIds.includes(convention.agencyId))
      .filter((convention) => convention.status === "ACCEPTED_BY_VALIDATOR");

    const matched =
      conventionsForUser.flatMap<ConventionWithUnfinalizedAssessment>(
        (convention) => {
          const assessment = this.assessmentRepository.assessments.find(
            (a) => a.conventionId === convention.id,
          );

          if (!assessment) {
            const dateEnd = new Date(convention.dateEnd);
            if (!isBefore(dateEnd, threeMonthsAgo) && !isAfter(dateEnd, now))
              return [
                {
                  id: convention.id,
                  dateEnd: convention.dateEnd,
                  beneficiary: {
                    firstname: convention.signatories.beneficiary.firstName,
                    lastname: convention.signatories.beneficiary.lastName,
                  },
                  assessment: null,
                },
              ];
            return [];
          }

          if (
            assessment.status === "FINISHED" ||
            assessment.status === "ABANDONED" ||
            assessment.status === "DID_NOT_SHOW"
          )
            return [];

          const createdAt = new Date(assessment.createdAt);

          const isAfterSignatureRelease = isAfter(
            createdAt,
            signatureReleaseThreshold,
          );
          const isCreatedAtLeastTwoDaysAgo = isBefore(createdAt, twoDaysAgo);
          const isWithinThreeMonths = !isBefore(createdAt, threeMonthsAgo);
          const isUnsigned =
            "signedAt" in assessment && assessment.signedAt === null;

          if (
            !isAfterSignatureRelease ||
            !isWithinThreeMonths ||
            !isUnsigned ||
            !isCreatedAtLeastTwoDaysAgo
          )
            return [];

          return [
            {
              id: convention.id,
              dateEnd: convention.dateEnd,
              beneficiary: {
                firstname: convention.signatories.beneficiary.firstName,
                lastname: convention.signatories.beneficiary.lastName,
              },
              assessment: {
                status: assessment.status,
                endedWithAJob: assessment.endedWithAJob ?? false,
                signedAt: assessment.signedAt ?? null,
                createdAt: assessment.createdAt,
              },
            },
          ];
        },
      );

    const filtered = match(assessmentCompletionStatus)
      .with("to-complete", () =>
        matched.filter((convention) => convention.assessment === null),
      )
      .with("to-sign", () =>
        matched.filter((convention) => convention.assessment !== null),
      )
      .with(undefined, () => matched)
      .exhaustive();

    const sorted = filtered.sort((a, b) => {
      const dateCompare =
        new Date(a.dateEnd).getTime() - new Date(b.dateEnd).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.id.localeCompare(b.id);
    });

    const startIndex = (pagination.page - 1) * pagination.perPage;
    const paginatedData = sorted.slice(
      startIndex,
      startIndex + pagination.perPage,
    );

    return {
      data: paginatedData,
      pagination: {
        totalRecords: sorted.length,
        currentPage: pagination.page,
        totalPages: Math.max(Math.ceil(sorted.length / pagination.perPage), 1),
        numberPerPage: pagination.perPage,
      },
    };
  }

  public async getConventionsWithErroredBroadcastFeedbackForAgencyUser({
    userAgencyIds,
    pagination,
    filters = {},
  }: {
    userAgencyIds: AgencyId[];
    pagination: Required<PaginationQueryParams>;
    filters?: ConventionsWithErroredBroadcastFeedbackFilters;
  }): Promise<DataWithPagination<ConventionWithBroadcastFeedback>> {
    const userConventions = this.conventionRepository.conventions.filter(
      (convention) => userAgencyIds.includes(convention.agencyId),
    );

    const results: ConventionWithBroadcastFeedback[] = await Promise.all(
      userConventions.map(async (convention) => {
        const lastBroadcastFeedback =
          await this.broadcastFeedbacksRepository.getLastBroadcastFeedback(
            convention.id,
          );
        return {
          id: convention.id,
          status: convention.status,
          beneficiary: {
            firstname: convention.signatories.beneficiary.firstName,
            lastname: convention.signatories.beneficiary.lastName,
          },
          lastBroadcastFeedback,
        };
      }),
    );

    const filteredResults = results
      .filter(
        (
          result,
        ): result is ConventionWithBroadcastFeedback & {
          lastBroadcastFeedback: NonNullable<
            ConventionWithBroadcastFeedback["lastBroadcastFeedback"]
          >;
        } => result.lastBroadcastFeedback !== null,
      )
      .filter((result) => {
        if (filters.broadcastErrorKind) {
          const message =
            result.lastBroadcastFeedback?.subscriberErrorFeedback?.message;
          if (!message) return false;

          const isFunctional = isFunctionalBroadcastFeedbackError(message);
          if (filters.broadcastErrorKind === "functional" && !isFunctional)
            return false;
          if (filters.broadcastErrorKind === "technical" && isFunctional)
            return false;
        }

        const hasPriorSuccessfulBroadcast =
          this.broadcastFeedbacksRepository.broadcastFeedbacks.some(
            (bf) =>
              bf.requestParams.conventionId === result.id &&
              !bf.subscriberErrorFeedback,
          );
        if (
          isUnvalidatedConventionStatus(result.status) &&
          !hasPriorSuccessfulBroadcast
        )
          return false;

        if (filters.conventionStatus && filters.conventionStatus.length > 0) {
          if (!filters.conventionStatus.includes(result.status)) return false;
        }

        if (filters.search) {
          if (result.id.toLowerCase() !== filters.search.toLowerCase())
            return false;
        }

        return true;
      });

    return {
      data: filteredResults
        .sort(
          (a, b) =>
            new Date(b.lastBroadcastFeedback.occurredAt).getTime() -
            new Date(a.lastBroadcastFeedback.occurredAt).getTime(),
        )
        .slice(
          (pagination.page - 1) * pagination.perPage,
          pagination.page * pagination.perPage,
        ),
      pagination: {
        totalRecords: filteredResults.length,
        currentPage: pagination.page,
        totalPages: Math.ceil(filteredResults.length / pagination.perPage),
        numberPerPage: pagination.perPage,
      },
    };
  }
}

const makeApplyFiltersToGetConventionIds =
  ({
    withAgencyIds,
    withAppelationCodes,
    withBeneficiary,
    withDateStart,
    withDateSubmission,
    withEndDate,
    withUpdateDate,
    withEstablishmentRepresentative,
    withEstablishmentTutor,
    withSirets,
    withStatuses,
  }: GetConventionIdsParams["filters"]) =>
  (convention: ConventionDto) =>
    (
      [
        ({ agencyId }) =>
          withAgencyIds && withAgencyIds.length > 0
            ? withAgencyIds.includes(agencyId)
            : true,
        ({ dateSubmission }) =>
          withDateSubmission?.from
            ? new Date(dateSubmission) >= withDateSubmission.from
            : true,
        ({ dateSubmission }) =>
          withDateSubmission?.to
            ? new Date(dateSubmission) <= withDateSubmission.to
            : true,
        ({ dateStart }) =>
          withDateStart?.to ? dateStart <= withDateStart : true,
        ({ dateStart }) =>
          withDateStart?.from ? dateStart >= withDateStart : true,
        ({ dateEnd }) =>
          withEndDate?.to ? new Date(dateEnd) <= withEndDate.to : true,
        ({ dateEnd }) =>
          withEndDate?.from ? new Date(dateEnd) >= withEndDate.from : true,
        ({ updatedAt }) =>
          withUpdateDate?.to && updatedAt
            ? new Date(updatedAt) <= withUpdateDate.to
            : true,
        ({ updatedAt }) =>
          withUpdateDate?.from && updatedAt
            ? new Date(updatedAt) >= withUpdateDate.from
            : true,
        ({ establishmentTutor }) =>
          withEstablishmentTutor?.email
            ? establishmentTutor.email === withEstablishmentTutor.email
            : true,
        ({ signatories: { establishmentRepresentative } }) =>
          withEstablishmentRepresentative?.email
            ? establishmentRepresentative.email ===
              withEstablishmentRepresentative.email
            : true,
        ({ signatories: { beneficiary } }) =>
          withBeneficiary?.lastName
            ? beneficiary.lastName === withBeneficiary.lastName
            : true,
        ({ signatories: { beneficiary } }) =>
          withBeneficiary?.birthdate
            ? beneficiary.birthdate === withBeneficiary.birthdate
            : true,
        ({ status }) =>
          withStatuses && withStatuses.length > 0
            ? withStatuses.includes(status)
            : true,
        ({ siret }) =>
          withSirets && withSirets.length > 0
            ? withSirets.includes(siret)
            : true,
        ({ immersionAppellation }) =>
          withAppelationCodes && withAppelationCodes.length > 0
            ? withAppelationCodes.includes(immersionAppellation.appellationCode)
            : true,
      ] satisfies Array<(convention: ConventionDto) => boolean>
    ).every((filter) => filter(convention));

const matchesDateFilter = (
  date: string,
  dateFilter: DateFilter | undefined,
): boolean => {
  if (!dateFilter) return true;

  const dateValue = new Date(date);

  if (dateFilter.from && dateFilter.to)
    return (
      dateValue >= new Date(dateFilter.from) &&
      dateValue <= new Date(dateFilter.to)
    );

  if (dateFilter.from) return dateValue >= new Date(dateFilter.from);
  if (dateFilter.to) return dateValue <= new Date(dateFilter.to);

  return true;
};

const matchesConventionSearch = (
  convention: ConventionDto,
  search: string,
): boolean => {
  const pattern = search.toLowerCase();
  const {
    beneficiary,
    establishmentRepresentative,
    beneficiaryRepresentative,
    beneficiaryCurrentEmployer,
  } = convention.signatories;

  const searchableFields = [
    convention.id,
    beneficiary.firstName,
    beneficiary.lastName,
    `${beneficiary.firstName} ${beneficiary.lastName}`,
    `${beneficiary.lastName} ${beneficiary.firstName}`,
    convention.businessName,
    convention.siret,
    beneficiary.email,
    establishmentRepresentative.email,
    convention.establishmentTutor.email,
    beneficiaryRepresentative?.email,
    beneficiaryCurrentEmployer?.email,
    convention.agencyReferent?.firstname,
    convention.agencyReferent?.lastname,
    convention.agencyReferent
      ? `${convention.agencyReferent.firstname} ${convention.agencyReferent.lastname}`
      : undefined,
    convention.agencyReferent
      ? `${convention.agencyReferent.lastname} ${convention.agencyReferent.firstname}`
      : undefined,
  ];

  return searchableFields.some(
    (field) => field && field.toLowerCase().includes(pattern),
  );
};

const sortConventionsInMemory = (
  conventions: ConventionDto[],
  sort?: Partial<WithSort<GetPaginatedConventionsSortBy>["sort"]>,
): ConventionDto[] => {
  const sortBy = sort?.by ?? "dateStart";
  const direction = sort?.direction ?? "desc";
  const multiplier = direction === "asc" ? 1 : -1;

  return [...conventions].sort((previous, current) => {
    const previousDate = previous[sortBy];
    const currentDate = current[sortBy];

    if (!previousDate && !currentDate)
      return previous.id.localeCompare(current.id);
    if (!previousDate) return 1;
    if (!currentDate) return -1;

    const dateCompare =
      (new Date(previousDate).getTime() - new Date(currentDate).getTime()) *
      multiplier;

    if (dateCompare !== 0) return dateCompare;

    return previous.id.localeCompare(current.id);
  });
};

const makeApplyPaginatedFiltersToConventions =
  ({
    search,
    statuses,
    agencyIds,
    dateStart,
    dateEnd,
    dateSubmission,
  }: GetPaginatedConventionsFilters) =>
  (convention: ConventionDto) => {
    const trimmedSearch = search?.trim();

    return (
      [
        () =>
          trimmedSearch
            ? matchesConventionSearch(convention, trimmedSearch)
            : true,
        ({ dateStart: conventionDateStart }) =>
          matchesDateFilter(conventionDateStart, dateStart),
        ({ dateEnd: conventionDateEnd }) =>
          matchesDateFilter(conventionDateEnd, dateEnd),
        ({ dateSubmission: conventionDateSubmission }) =>
          matchesDateFilter(conventionDateSubmission, dateSubmission),
        ({ status }) =>
          statuses && statuses.length > 0 ? statuses.includes(status) : true,
        ({ agencyId }) =>
          agencyIds && agencyIds.length > 0
            ? agencyIds.includes(agencyId)
            : true,
      ] satisfies Array<(convention: ConventionDto) => boolean>
    ).every((filter) => filter(convention));
  };

const makeApplyFiltersToConventions =
  ({
    agencyIds,
    ids,
    startDateLessOrEqual,
    startDateGreater,
    withStatuses,
    dateSubmissionEqual,
    dateSubmissionSince,
    withSirets,
    withBeneficiary,
    endDate,
    updateDate,
  }: GetConventionsFilters) =>
  (convention: ConventionDto) =>
    (
      [
        ({ agencyId: conventionAgencyId }) =>
          agencyIds && agencyIds.length > 0
            ? agencyIds.includes(conventionAgencyId)
            : true,
        ({ id }) => (ids && ids.length > 0 ? ids.includes(id) : true),
        ({ dateEnd }) => (endDate?.to ? new Date(dateEnd) <= endDate.to : true),
        ({ dateEnd }) =>
          endDate?.from ? new Date(dateEnd) >= endDate.from : true,
        ({ updatedAt }) =>
          updateDate?.to && updatedAt
            ? new Date(updatedAt) <= updateDate.to
            : true,
        ({ updatedAt }) =>
          updateDate?.from && updatedAt
            ? new Date(updatedAt) >= updateDate.from
            : true,
        ({ dateStart }) =>
          startDateLessOrEqual
            ? new Date(dateStart) <= startDateLessOrEqual
            : true,
        ({ dateStart }) =>
          startDateGreater ? new Date(dateStart) > startDateGreater : true,
        ({ dateSubmission }) =>
          dateSubmissionEqual
            ? new Date(dateSubmission).getTime() ===
              dateSubmissionEqual.getTime()
            : true,
        ({ dateSubmission }) =>
          dateSubmissionSince
            ? new Date(dateSubmission).getTime() >=
              dateSubmissionSince.getTime()
            : true,
        ({ status }) =>
          withStatuses && withStatuses.length > 0
            ? withStatuses.includes(status)
            : true,

        ({ siret }) =>
          withSirets && withSirets.length > 0
            ? withSirets.includes(siret)
            : true,
        ({ signatories }) =>
          withBeneficiary?.email
            ? signatories.beneficiary.email === withBeneficiary.email
            : true,
      ] satisfies Array<(convention: ConventionDto) => boolean>
    ).every((filter) => filter(convention));

const makeApplyAssessmentCompletionStatusFilter =
  (
    {
      assessmentCompletionStatus,
    }: Pick<GetPaginatedConventionsFilters, "assessmentCompletionStatus">,
    assessments: AssessmentEntity[],
  ) =>
  (convention: ConventionDto) => {
    if (!assessmentCompletionStatus || assessmentCompletionStatus.length === 0)
      return true;
    if (convention.status !== "ACCEPTED_BY_VALIDATOR") return false;

    const hasFinalizedFilter = assessmentCompletionStatus.includes("finalized");
    const hasToSignFilter = assessmentCompletionStatus.includes("to-sign");
    const hasToBeCompletedFilter =
      assessmentCompletionStatus.includes("to-complete");

    if (hasFinalizedFilter && hasToSignFilter && hasToBeCompletedFilter)
      return true;

    const assessmentEntity = assessments.find(
      (assessment) => assessment.conventionId === convention.id,
    );
    const assessmentFields =
      assesmentEntityToConventionAssessmentFields(assessmentEntity);
    const assessment = assessmentFields.assessment;

    const isNotLegacyAssessment =
      assessment !== null &&
      assessment.status !== "FINISHED" &&
      assessment.status !== "ABANDONED";

    const isAssessementAfterSignatureRelease =
      assessment !== null &&
      isAfter(
        new Date(assessment.createdAt),
        addDays(ASSESSEMENT_SIGNATURE_RELEASE_DATE, 1),
      );
    const isAssessmentSigned =
      assessment !== null &&
      "signedAt" in assessment &&
      assessment.signedAt !== null;

    const isAssessmentFinalized =
      isNotLegacyAssessment &&
      assessment !== null &&
      ((isAssessmentSigned && isAssessementAfterSignatureRelease) ||
        assessment.status === "DID_NOT_SHOW" ||
        !isAssessementAfterSignatureRelease);

    const isAssessmentToSign =
      isNotLegacyAssessment &&
      assessment !== null &&
      !isAssessmentSigned &&
      isAssessementAfterSignatureRelease &&
      assessment.status !== "DID_NOT_SHOW";
    const isAssessmentToBeCompleted =
      assessment === null &&
      !isConventionEndingInOneDayOrMore(convention.dateEnd);

    return (
      (hasFinalizedFilter && isAssessmentFinalized) ||
      (hasToSignFilter && isAssessmentToSign) ||
      (hasToBeCompletedFilter && isAssessmentToBeCompleted)
    );
  };
