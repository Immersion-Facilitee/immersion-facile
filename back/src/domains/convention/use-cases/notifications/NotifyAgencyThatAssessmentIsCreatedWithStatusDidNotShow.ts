import { uniq } from "ramda";
import {
  type Email,
  getFormattedFirstnameAndLastname,
  withAssessmentSchema,
} from "shared";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { retrieveConventionWithAgency } from "../../entities/Convention";

export type NotifyAgencyThatAssessmentIsCreatedWithStatusDidNotShow =
  ReturnType<
    typeof makeNotifyAgencyThatAssessmentIsCreatedWithStatusDidNotShow
  >;

export const makeNotifyAgencyThatAssessmentIsCreatedWithStatusDidNotShow =
  useCaseBuilder("NotifyAgencyThatAssessmentIsCreatedWithStatusDidNotShow")
    .withInput(withAssessmentSchema)
    .withDeps<{
      saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    }>()
    .build(async ({ inputParams: { assessment }, uow, deps }) => {
      if (assessment.status !== "DID_NOT_SHOW") return;

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

      await deps.saveNotificationAndRelatedEvent(uow, {
        kind: "email",
        templatedContent: {
          kind: "ASSESSMENT_CREATED_WITH_STATUS_DID_NOT_SHOW_AGENCY_NOTIFICATION",
          recipients: agencyEmails,
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
            immersionAppellationLabel:
              convention.immersionAppellation.appellationLabel,
          },
        },
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
        },
      });
    });
