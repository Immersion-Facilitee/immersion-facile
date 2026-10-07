import {
  type AssessmentDto,
  type ConventionRelatedJwtPayload,
  errors,
  type LegacyAssessmentDto,
  type WithConventionId,
  withConventionIdSchema,
} from "shared";
import { agencyWithRightToAgencyDto } from "../../../utils/agency";
import { throwForbiddenIfNotAllowedForAssessments } from "../../../utils/assessment";
import { getUserWithRights } from "../../connected-users/helpers/userRights.helper";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { toAssessmentDto } from "../entities/AssessmentEntity";
import {
  retrieveConventionWithAgency,
  throwIfConventionArchivedForNonAdmin,
} from "../entities/Convention";

export type GetAssessmentByConventionId = ReturnType<
  typeof makeGetAssessmentByConventionId
>;
export const makeGetAssessmentByConventionId = useCaseBuilder(
  "GetAssessmentByConventionId",
)
  .withInput<WithConventionId>(withConventionIdSchema)
  .withOutput<AssessmentDto | LegacyAssessmentDto>()
  .withCurrentUser<ConventionRelatedJwtPayload | undefined>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(async ({ uow, currentUser, inputParams, deps }) => {
    if (!currentUser) throw errors.user.noJwtProvided();
    const { agency, convention } = await retrieveConventionWithAgency(
      uow,
      inputParams.conventionId,
    );
    await throwForbiddenIfNotAllowedForAssessments({
      mode: "GetAssessment",
      convention,
      agency: await agencyWithRightToAgencyDto(uow, agency),
      jwtPayload: currentUser,
      uow,
    });

    const isBackofficeAdmin =
      "userId" in currentUser
        ? !!(await getUserWithRights(uow, currentUser.userId)).isBackofficeAdmin
        : false;

    throwIfConventionArchivedForNonAdmin({
      convention,
      now: deps.timeGateway.now(),
      isBackofficeAdmin,
      featureFlags: await uow.featureFlagQueries.getAll(),
    });

    const assessment = await uow.assessmentRepository.getByConventionId(
      inputParams.conventionId,
    );
    if (!assessment) {
      throw errors.assessment.notFound(inputParams.conventionId);
    }
    return toAssessmentDto(assessment);
  });
