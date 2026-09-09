import { values } from "ramda";
import {
  type AgencyWithUsersRights,
  type ConventionDto,
  executeInSequence,
  filterNotFalsy,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  type Signatory,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { retrieveConventionWithAgency } from "../../entities/Convention";

export const NO_JUSTIFICATION = "Aucune justification trouvée.";

export type NotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification =
  ReturnType<
    typeof makeNotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification
  >;

type Deps = {
  config: AppConfig;
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
};

export const makeNotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification =
  useCaseBuilder(
    "NotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification",
  )
    .withInput(withConventionSchema)
    .withDeps<Deps>()
    .build(async ({ inputParams: { convention }, uow, deps }) => {
      const { agency, convention: conventionReadDto } =
        await retrieveConventionWithAgency(uow, convention.id);
      await executeInSequence(
        values(conventionReadDto.signatories)
          .filter(filterNotFalsy)
          .filter((signatory) => !signatory.signedAt),
        async (signatory) =>
          deps.saveNotificationAndRelatedEvent(uow, {
            kind: "email",
            templatedContent: makeEmail(
              signatory,
              conventionReadDto,
              agency,
              deps.config,
            ),
            followedIds: {
              conventionId: conventionReadDto.id,
              agencyId: conventionReadDto.agencyId,
              establishmentSiret: conventionReadDto.siret,
            },
          }),
      );
    });

const makeEmail = (
  signatory: Signatory,
  convention: ConventionDto,
  agency: AgencyWithUsersRights,
  config: AppConfig,
): TemplatedEmail => ({
  kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE_AFTER_MODIFICATION",
  recipients: [signatory.email],
  params: {
    agencyLogoUrl: agency.logoUrl ?? undefined,
    beneficiaryFirstName: getFormattedFirstnameAndLastname({
      firstname: convention.signatories.beneficiary.firstName,
    }),
    beneficiaryLastName: getFormattedFirstnameAndLastname({
      lastname: convention.signatories.beneficiary.lastName,
    }),
    businessName: convention.businessName,
    conventionId: convention.id,
    conventionSignatureLink: makeRouteAbsoluteUrl({
      route: frontRoutes.manageConventionConnectedUser({
        conventionId: convention.id,
        loginPersona:
          signatory.role === "establishment-representative"
            ? "professional"
            : "beneficiary",
        at_campaign: "email-signature-link-after-modification",
      }),
      baseUrl: config.immersionFacileBaseUrl,
    }),
    justification: convention.statusJustification ?? NO_JUSTIFICATION,
    signatoryFirstName: getFormattedFirstnameAndLastname({
      firstname: signatory.firstName,
    }),
    signatoryLastName: getFormattedFirstnameAndLastname({
      lastname: signatory.lastName,
    }),
    internshipKind: convention.internshipKind,
  },
});
