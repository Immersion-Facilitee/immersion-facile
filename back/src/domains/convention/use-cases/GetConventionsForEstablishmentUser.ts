import { subMonths } from "date-fns";
import {
  type ConnectedUser,
  type ConventionDto,
  type ConventionId,
  type DataWithPagination,
  defaultMonthsThresholdForConventionsListing,
  type EstablishmentUserConventionListDto,
  getDisplayedBusinessName,
  getPaginationParamsForWeb,
  type PaginationQueryParams,
  paginationQueryParamsSchema,
  partitionUserEstablishmentRightsByStatus,
} from "shared";
import { assesmentEntityToConventionAssessmentFields } from "../../../utils/convention";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { AssessmentEntity } from "../entities/AssessmentEntity";

export const makeGetConventionsForEstablishmentUser = useCaseBuilder(
  "GetConventionsForEstablishmentUser",
)
  .withInput<PaginationQueryParams>(paginationQueryParamsSchema)
  .withOutput<DataWithPagination<EstablishmentUserConventionListDto>>()
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(async ({ inputParams, uow, currentUser, deps }) => {
    const featureFlags = await uow.featureFlagQueries.getAll();
    const { acceptedUserEstablishmentsRights } =
      partitionUserEstablishmentRightsByStatus(currentUser.establishments);

    const paginatedConventions =
      await uow.conventionQueries.getPaginatedConventions({
        sort: { by: "dateStart", direction: "desc" },
        filters: {
          establishmentUserAccess: {
            email: currentUser.email,
            sirets: acceptedUserEstablishmentsRights.map(({ siret }) => siret),
          },
          ...(featureFlags.enableRequestArchivedConvention.isActive
            ? {}
            : {
                dateEnd: {
                  from: subMonths(
                    deps.timeGateway.now(),
                    defaultMonthsThresholdForConventionsListing,
                  ).toISOString(),
                },
              }),
        },
        pagination: getPaginationParamsForWeb(inputParams),
      });

    const assessments = await uow.assessmentRepository.getByConventionIds(
      paginatedConventions.data.map(({ id }) => id),
    );
    const assessmentByConventionId: Record<ConventionId, AssessmentEntity> =
      assessments.reduce(
        (acc, assessment) => ({
          ...acc,
          [assessment.conventionId]: assessment,
        }),
        {},
      );

    return {
      data: paginatedConventions.data.map((convention) =>
        toEstablishmentUserConventionListDto(
          convention,
          assessmentByConventionId[convention.id],
        ),
      ),
      pagination: paginatedConventions.pagination,
    };
  });

const toEstablishmentUserConventionListDto = (
  convention: ConventionDto,
  assessment: AssessmentEntity | undefined,
): EstablishmentUserConventionListDto => {
  const { beneficiary } = convention.signatories;

  return {
    id: convention.id,
    status: convention.status,
    dateStart: convention.dateStart,
    dateEnd: convention.dateEnd,
    businessName: getDisplayedBusinessName(convention),
    immersionAppellation: convention.immersionAppellation,
    assessment:
      assesmentEntityToConventionAssessmentFields(assessment).assessment,
    beneficiary: {
      firstName: beneficiary.firstName,
      lastName: beneficiary.lastName,
    },
  };
};
