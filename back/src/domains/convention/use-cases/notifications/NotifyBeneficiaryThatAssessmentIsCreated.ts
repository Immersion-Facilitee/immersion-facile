import {
  errors,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  type WithAssessmentDto,
  withAssessmentSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyBeneficiaryThatAssessmentIsCreated = ReturnType<
  typeof makeNotifyBeneficiaryThatAssessmentIsCreated
>;
export const makeNotifyBeneficiaryThatAssessmentIsCreated = useCaseBuilder(
  "NotifyBeneficiaryThatAssessmentIsCreated",
)
  .withInput<WithAssessmentDto>(withAssessmentSchema)
  .withOutput<void>()
  .withCurrentUser<void>()
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    config: AppConfig;
  }>()
  .build(async ({ uow, inputParams, deps }) => {
    const convention = await uow.conventionRepository.getById(
      inputParams.assessment.conventionId,
    );

    if (!convention)
      throw errors.convention.notFound({
        conventionId: inputParams.assessment.conventionId,
      });

    const followedIds = {
      conventionId: convention.id,
      agencyId: convention.agencyId,
      establishmentSiret: convention.siret,
    };

    const magicLink = makeRouteAbsoluteUrl({
      route: frontRoutes.assessmentDocument({
        conventionId: convention.id,
        loginPersona: "beneficiary",
      }),
      baseUrl: deps.config.immersionFacileBaseUrl,
    });

    await deps.saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "ASSESSMENT_CREATED_BENEFICIARY_NOTIFICATION",
        recipients: [convention.signatories.beneficiary.email],
        params: {
          internshipKind: convention.internshipKind,
          conventionId: convention.id,
          beneficiaryLastName: getFormattedFirstnameAndLastname({
            lastname: convention.signatories.beneficiary.lastName,
          }),
          beneficiaryFirstName: getFormattedFirstnameAndLastname({
            firstname: convention.signatories.beneficiary.firstName,
          }),
          magicLink,
        },
      },
      followedIds,
    });

    if (
      convention.internshipKind === "mini-stage-cci" &&
      convention.signatories.beneficiaryRepresentative
    ) {
      await deps.saveNotificationAndRelatedEvent(uow, {
        kind: "email",
        templatedContent: {
          kind: "ASSESSMENT_CREATED_BENEFICIARY_NOTIFICATION",
          recipients: [convention.signatories.beneficiaryRepresentative.email],
          params: {
            internshipKind: convention.internshipKind,
            conventionId: convention.id,
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: convention.signatories.beneficiary.lastName,
            }),
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname: convention.signatories.beneficiary.firstName,
            }),
            magicLink,
          },
        },
        followedIds,
      });
    }
  });
