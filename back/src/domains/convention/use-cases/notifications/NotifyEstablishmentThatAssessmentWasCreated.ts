import {
  type ConventionEstablishmentRole,
  errors,
  getDisplayedBusinessName,
  getFormattedFirstnameAndLastname,
  type WithAssessmentDto,
  withAssessmentSchema,
} from "shared";
import type { GenerateConventionMagicLinkUrl } from "../../../../config/bootstrap/magicLinkUrl";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyEstablishmentThatAssessmentWasCreated = ReturnType<
  typeof makeNotifyEstablishmentThatAssessmentWasCreated
>;
export const makeNotifyEstablishmentThatAssessmentWasCreated = useCaseBuilder(
  "NotifyEstablishmentThatAssessmentWasCreated",
)
  .withInput<WithAssessmentDto>(withAssessmentSchema)
  .withOutput<void>()
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    generateLink: GenerateConventionMagicLinkUrl;
    timeGateway: TimeGateway;
  }>()
  .build(
    async ({
      inputParams: { assessment },
      uow,
      deps: { saveNotificationAndRelatedEvent, generateLink, timeGateway },
    }) => {
      const convention = await uow.conventionRepository.getById(
        assessment.conventionId,
      );

      if (!convention)
        throw errors.convention.notFound({
          conventionId: assessment.conventionId,
        });

      const sendEmailForRole = (role: ConventionEstablishmentRole) =>
        saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent: {
            kind: "ASSESSMENT_CREATED_ESTABLISHMENT_NOTIFICATION",
            recipients:
              role === "establishment-representative"
                ? [convention.signatories.establishmentRepresentative.email]
                : [convention.establishmentTutor.email],
            params: {
              beneficiaryFullName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
                lastname: convention.signatories.beneficiary.lastName,
              }),
              recipientFullName:
                role === "establishment-representative"
                  ? `${getFormattedFirstnameAndLastname({
                      firstname:
                        convention.signatories.establishmentRepresentative
                          .firstName,
                      lastname:
                        convention.signatories.establishmentRepresentative
                          .lastName,
                    })}`
                  : `${getFormattedFirstnameAndLastname({
                      firstname: convention.establishmentTutor.firstName,
                      lastname: convention.establishmentTutor.lastName,
                    })}`,
              internshipKind: convention.internshipKind,
              businessName: getDisplayedBusinessName(convention),
              linkToAssessment: generateLink({
                id: convention.id,
                email:
                  role === "establishment-representative"
                    ? convention.signatories.establishmentRepresentative.email
                    : convention.establishmentTutor.email,
                role,
                targetRoute: "assessmentDocument",
                now: timeGateway.now(),
                lifetime: "1Month",
              }),
            },
          },
          followedIds: {
            establishmentSiret: convention.siret,
            conventionId: assessment.conventionId,
          },
        });

      await Promise.all([
        sendEmailForRole("establishment-representative"),
        ...(convention.signatories.establishmentRepresentative.email ===
        convention.establishmentTutor.email
          ? []
          : [sendEmailForRole("establishment-tutor")]),
      ]);
    },
  );
