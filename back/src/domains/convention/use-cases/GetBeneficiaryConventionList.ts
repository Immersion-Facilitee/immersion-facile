import {
  type BeneficiaryConventionListDto,
  type ConnectedUser,
  type ConventionId,
  type GetBeneficiaryConventionListParams,
  getBeneficiaryConventionListParamsSchema,
  getPaginationParamsForWeb,
} from "shared";
import { assesmentEntityToConventionAssessmentFields } from "../../../utils/convention";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { AssessmentEntity } from "../entities/AssessmentEntity";

export const makeGetBeneficiaryConventionList = useCaseBuilder(
  "GetBeneficiaryConventionList",
)
  .withInput<GetBeneficiaryConventionListParams>(
    getBeneficiaryConventionListParamsSchema,
  )
  .withOutput<BeneficiaryConventionListDto>()
  .withCurrentUser<ConnectedUser>()
  .build(async ({ inputParams, uow, currentUser }) => {
    const pagination = getPaginationParamsForWeb(inputParams.pagination);

    const paginated = await uow.conventionQueries.getPaginatedConventions({
      filters: {
        search: inputParams.filters?.search,
        beneficiaryEmail: currentUser.email,
      },
      sort: { by: "dateStart", direction: "desc" },
      pagination,
    });

    const assessments = await uow.assessmentRepository.getByConventionIds(
      paginated.data.map(({ id }) => id),
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
      data: paginated.data.map((convention) => ({
        conventionId: convention.id,
        businessName: convention.businessName,
        status: convention.status,
        assessment: assesmentEntityToConventionAssessmentFields(
          assessmentByConventionId[convention.id],
        ).assessment,
        dateStart: convention.dateStart,
        dateEnd: convention.dateEnd,
      })),
      pagination: paginated.pagination,
    };
  });
