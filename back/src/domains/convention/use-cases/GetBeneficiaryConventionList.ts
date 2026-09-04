import { subMonths } from "date-fns";
import {
  type BeneficiaryConventionListDto,
  type ConnectedUser,
  type ConventionId,
  defaultMonthsThresholdForConventionsListing,
} from "shared";
import { assesmentEntityToConventionAssessmentFields } from "../../../utils/convention";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { AssessmentEntity } from "../entities/AssessmentEntity";

export const makeGetBeneficiaryConventionList = useCaseBuilder(
  "GetBeneficiaryConventionList",
)
  .withOutput<BeneficiaryConventionListDto>()
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(async ({ uow, currentUser, deps }) => {
    const featureFlags = await uow.featureFlagQueries.getAll();

    const conventions = await uow.conventionQueries.getConventions({
      filters: {
        withBeneficiary: { email: currentUser.email },
        ...(featureFlags.enableRequestArchivedConvention.isActive
          ? {}
          : {
              endDate: {
                from: subMonths(
                  deps.timeGateway.now(),
                  defaultMonthsThresholdForConventionsListing,
                ),
              },
            }),
      },
      sortBy: "dateStart",
    });
    const assessments = await uow.assessmentRepository.getByConventionIds(
      conventions.map(({ id }) => id),
    );
    const assessmentByConventionId: Record<ConventionId, AssessmentEntity> =
      assessments.reduce(
        (acc, assessment) => ({
          ...acc,
          [assessment.conventionId]: assessment,
        }),
        {},
      );

    return conventions.map((convention) => ({
      conventionId: convention.id,
      businessName: convention.businessName,
      status: convention.status,
      assessment: assesmentEntityToConventionAssessmentFields(
        assessmentByConventionId[convention.id],
      ).assessment,
      dateStart: convention.dateStart,
      dateEnd: convention.dateEnd,
    }));
  });
