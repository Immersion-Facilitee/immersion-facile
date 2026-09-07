import { uniq } from "ramda";
import {
  computeTotalHours,
  type Email,
  executeInSequence,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  withAssessmentSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { retrieveConventionWithAgency } from "../../entities/Convention";

export type NotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted =
  ReturnType<
    typeof makeNotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted
  >;

export const makeNotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted =
  useCaseBuilder(
    "NotifyAgencyThatAssessmentIsCreatedWithStatusCompletedOrPartiallyCompleted",
  )
    .withInput(withAssessmentSchema)
    .withDeps<{
      saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
      config: AppConfig;
    }>()
    .build(async ({ inputParams: { assessment }, uow, deps }) => {
      if (assessment.status === "DID_NOT_SHOW" || !assessment.signedAt) {
        return;
      }

      const { agency, convention } = await retrieveConventionWithAgency(
        uow,
        assessment.conventionId,
      );

      const { validatorEmails, counsellorEmails } =
        await agencyWithRightToAgencyDto(uow, agency);

      const conventionAdvisorEmail =
        convention.signatories.beneficiary.federatedIdentity?.payload?.advisor
          ?.email;

      const agencyEmails: Email[] = conventionAdvisorEmail
        ? [conventionAdvisorEmail]
        : uniq([...validatorEmails, ...counsellorEmails]);

      const numberOfHoursMade = computeTotalHours({
        convention,
        lastDayOfPresence:
          assessment.status === "PARTIALLY_COMPLETED"
            ? assessment.lastDayOfPresence
            : "",
        numberOfMissedHours:
          assessment.status === "PARTIALLY_COMPLETED"
            ? assessment.numberOfMissedHours
            : 0,
        status: assessment.status,
      });

      await executeInSequence(agencyEmails, async (email) => {
        const manageConventionLink = makeRouteAbsoluteUrl({
          route: frontRoutes.manageConventionConnectedUser({
            conventionId: convention.id,
          }),
          baseUrl: deps.config.immersionFacileBaseUrl,
        });
        await deps.saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent: {
            kind: "ASSESSMENT_CREATED_WITH_STATUS_COMPLETED_AGENCY_NOTIFICATION",
            recipients: [email],
            params: {
              agencyReferentName: getFormattedFirstnameAndLastname(
                convention.agencyReferent ?? {},
              ),
              beneficiaryFirstName: getFormattedFirstnameAndLastname({
                firstname: convention.signatories.beneficiary.firstName,
              }),
              beneficiaryLastName: getFormattedFirstnameAndLastname({
                lastname: convention.signatories.beneficiary.lastName,
              }),
              businessName: convention.businessName,
              conventionId: convention.id,
              immersionObjective: convention.immersionObjective,
              internshipKind: convention.internshipKind,
              conventionDateEnd: convention.dateEnd,
              immersionAppellationLabel:
                convention.immersionAppellation.appellationLabel,
              assessment,
              numberOfHoursMade,
              manageConventionLink,
            },
          },
          followedIds: {
            conventionId: convention.id,
            agencyId: convention.agencyId,
            establishmentSiret: convention.siret,
          },
        });
      });
    });
