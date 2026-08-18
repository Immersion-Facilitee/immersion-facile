import {
  type AgencyDto,
  type ConventionDto,
  type Email,
  errors,
  executeInSequence,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

export type NotifyToAgencyConventionSubmitted = ReturnType<
  typeof makeNotifyToAgencyConventionSubmitted
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  config: AppConfig;
};

export const makeNotifyToAgencyConventionSubmitted = useCaseBuilder(
  "NotifyToAgencyConventionSubmitted",
)
  .withInput(withConventionSchema)
  .withDeps<Deps>()
  .build(async ({ inputParams: { convention }, uow, deps }) => {
    const [agencyWithRights] = await uow.agencyRepository.getByIds([
      convention.agencyId,
    ]);
    if (!agencyWithRights)
      throw errors.agency.notFound({ agencyId: convention.agencyId });

    const agency = await agencyWithRightToAgencyDto(uow, agencyWithRights);

    const conventionAdvisorEntity =
      await uow.conventionFranceTravailAdvisorRepository.getByConventionId(
        convention.id,
      );

    const recipientsAndWarning = conventionAdvisorEntity?.advisor
      ? {
          recipients: [conventionAdvisorEntity.advisor.email],
          warning: undefined,
        }
      : {
          recipients:
            agency.counsellorEmails.length > 0
              ? agency.counsellorEmails
              : agency.validatorEmails,
          warning:
            agency.kind === "france-travail"
              ? "Merci de vérifier le conseiller référent associé à ce bénéficiaire."
              : undefined,
        };

    return sendEmailToRecipients({
      agency,
      convention,
      uow,
      deps,
      ...recipientsAndWarning,
    });
  });

const sendEmailToRecipients = async ({
  agency,
  recipients,
  convention,
  warning,
  uow,
  deps: { saveNotificationAndRelatedEvent, config },
}: {
  recipients: Email[];
  agency: AgencyDto;
  convention: ConventionDto;
  warning?: string;
  uow: UnitOfWork;
  deps: Deps;
}) => {
  await executeInSequence(recipients, (email) =>
    saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "NEW_CONVENTION_AGENCY_NOTIFICATION",
        recipients: [email],
        params: {
          internshipKind: convention.internshipKind,
          agencyName: agency.name,
          agencyReferentName: getFormattedFirstnameAndLastname(
            convention.agencyReferent ?? {},
          ),
          businessName: convention.businessName,
          dateEnd: convention.dateEnd,
          dateStart: convention.dateStart,
          conventionId: convention.id,
          firstName: getFormattedFirstnameAndLastname({
            firstname: convention.signatories.beneficiary.firstName,
          }),
          lastName: getFormattedFirstnameAndLastname({
            lastname: convention.signatories.beneficiary.lastName,
          }),
          manageConventionLink: makeRouteAbsoluteUrl({
            route: frontRoutes.manageConventionConnectedUser({
              conventionId: convention.id,
            }),
            baseUrl: config.immersionFacileBaseUrl,
          }),
          agencyLogoUrl: agency.logoUrl ?? undefined,
          warning,
        },
      },
      followedIds: {
        conventionId: convention.id,
        agencyId: convention.agencyId,
        establishmentSiret: convention.siret,
      },
    }),
  );
};
