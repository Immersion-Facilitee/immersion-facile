import {
  type ConventionRelatedJwtPayload,
  errors,
  signAssessmentRequestDtoSchema,
} from "shared";
import { throwIfNotAuthorizedForRole } from "../../connected-users/helpers/authorization.helper";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { getOnlyAssessmentDto } from "../entities/AssessmentEntity";
import { retrieveConventionWithAgency } from "../entities/Convention";

export type SignAssessment = ReturnType<typeof makeSignAssessment>;

export const makeSignAssessment = useCaseBuilder("SignAssessment")
  .withInput(signAssessmentRequestDtoSchema)
  .withOutput<void>()
  .withCurrentUser<ConventionRelatedJwtPayload>()
  .withDeps<{
    createNewEvent: CreateNewEvent;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ inputParams, uow, deps, currentUser: jwtPayload }) => {
    const { agency, convention } = await retrieveConventionWithAgency(
      uow,
      inputParams.conventionId,
    );

    await throwIfNotAuthorizedForRole({
      authorizedRoles: ["beneficiary"],
      uow,
      jwtPayload,
      convention,
      agencyWithUserRights: agency,
      errorToThrow: errors.assessment.signForbidden(),
      isPeAdvisorAllowed: false,
      isValidatorOfAgencyRefersToAllowed: false,
    });

    const assessmentEntity = await uow.assessmentRepository.getByConventionId(
      inputParams.conventionId,
    );
    if (!assessmentEntity)
      throw errors.assessment.notFound(inputParams.conventionId);

    const assessmentDto = getOnlyAssessmentDto(assessmentEntity);
    if (!assessmentDto)
      throw errors.assessment.signNotAvailableForLegacyAssessment();

    if (assessmentDto.signedAt)
      throw errors.assessment.alreadySigned(inputParams.conventionId);

    const signedAssessmentDto = {
      ...assessmentDto,
      beneficiaryAgreement: inputParams.beneficiaryAgreement,
      beneficiaryFeedback: inputParams.beneficiaryFeedback,
      signedAt: deps.timeGateway.now().toISOString(),
    };

    await uow.assessmentRepository.update({
      ...assessmentEntity,
      ...signedAssessmentDto,
    });

    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "AssessmentSignedByBeneficiary",
        payload: {
          conventionId: inputParams.conventionId,
          assessment: signedAssessmentDto,
          triggeredBy:
            "userId" in jwtPayload
              ? {
                  kind: "connected-user",
                  userId: jwtPayload.userId,
                }
              : {
                  kind: "convention-magic-link",
                  role: jwtPayload.role,
                },
        },
      }),
    );
  });
