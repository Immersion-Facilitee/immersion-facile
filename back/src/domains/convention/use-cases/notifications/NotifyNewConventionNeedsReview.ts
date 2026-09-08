import {
  type AgencyDto,
  type ConventionRole,
  type ConventionStatus,
  executeInSequence,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  type TemplatedEmail,
  type WithFtConnectAdvisorForBeneficiary,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import { createLogger } from "../../../../utils/logger";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

const logger = createLogger(__filename);

export type NotifyNewConventionNeedsReview = ReturnType<
  typeof makeNotifyNewConventionNeedsReview
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  config: AppConfig;
};

export const makeNotifyNewConventionNeedsReview = useCaseBuilder(
  "NotifyNewConventionNeedsReview",
)
  .withInput(withConventionSchema)
  .withDeps<Deps>()
  .build(async ({ inputParams: { convention }, uow, deps }) => {
    const agency = await uow.agencyRepository.getById(convention.agencyId);

    if (!agency) {
      logger.error({
        agencyId: convention.agencyId,
        message: "No Agency Config found for this agency code",
      });
      return;
    }

    const recipients = determineRecipients(
      convention.status,
      await agencyWithRightToAgencyDto(uow, agency),
      convention.signatories.beneficiary.federatedIdentity?.payload?.advisor,
    );

    if (!recipients) {
      logger.error({
        conventionId: convention.id,
        agencyId: convention.agencyId,
        message:
          "Unable to find appropriate recipient for validation notification.",
      });
      return;
    }

    const emails: TemplatedEmail[] = await Promise.all(
      recipients.map(async (recipient) => ({
        kind: "NEW_CONVENTION_REVIEW_FOR_ELIGIBILITY_OR_VALIDATION",
        recipients: [recipient.email],
        params: {
          agencyLogoUrl: agency.logoUrl ?? undefined,
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
          internshipKind: convention.internshipKind,
          manageConventionLink: makeRouteAbsoluteUrl({
            route: frontRoutes.manageConventionConnectedUser({
              conventionId: convention.id,
            }),
            baseUrl: deps.config.immersionFacileBaseUrl,
          }),
          possibleRoleAction:
            recipient.role === "counsellor"
              ? "en vérifier l'éligibilité"
              : "en considérer la validation",
          validatorName: convention.validators?.agencyCounsellor
            ? getFormattedFirstnameAndLastname(
                convention.validators.agencyCounsellor,
              )
            : "",
          peAdvisor: recipient.peAdvisor,
        },
      })),
    );

    await executeInSequence(emails, (email) =>
      deps.saveNotificationAndRelatedEvent(uow, {
        kind: "email",
        templatedContent: email,
        followedIds: {
          conventionId: convention.id,
          agencyId: convention.agencyId,
          establishmentSiret: convention.siret,
        },
      }),
    );
  });

type Recipient = {
  role: ConventionRole;
  email: string;
  peAdvisor:
    | {
        recipientIsPeAdvisor: boolean;
        firstName: string;
        lastName: string;
        email: string;
      }
    | undefined;
};

const determineRecipients = (
  status: ConventionStatus,
  agency: AgencyDto,
  peAdvisor: WithFtConnectAdvisorForBeneficiary["advisor"],
): Recipient[] => {
  const hasCounsellorEmails = agency.counsellorEmails.length > 0;
  const hasValidatorEmails = agency.validatorEmails.length > 0;

  switch (status) {
    case "IN_REVIEW": {
      if (hasCounsellorEmails)
        return agency.counsellorEmails.map(
          (email): Recipient => ({
            role: "counsellor",
            email,
            peAdvisor: undefined,
          }),
        );

      if (peAdvisor) {
        return [
          {
            role: "validator",
            email: peAdvisor.email,
            peAdvisor: {
              recipientIsPeAdvisor: true,
              ...peAdvisor,
            },
          },
        ];
      }

      if (hasValidatorEmails)
        return agency.validatorEmails.map(
          (email): Recipient => ({
            role: "validator",
            email,
            peAdvisor: undefined,
          }),
        );

      return [];
    }
    case "ACCEPTED_BY_COUNSELLOR":
      if (peAdvisor) {
        return [
          {
            role: "validator",
            email: peAdvisor.email,
            peAdvisor: {
              recipientIsPeAdvisor: true,
              ...peAdvisor,
            },
          },
        ];
      }

      return agency.validatorEmails.map(
        (email): Recipient => ({
          role: "validator",
          email,
          peAdvisor: undefined,
        }),
      );

    default:
      // This notification may fire when using the /debug/populate route, with
      // statuses not included in the above list. Ignore this case.
      return [];
  }
};
