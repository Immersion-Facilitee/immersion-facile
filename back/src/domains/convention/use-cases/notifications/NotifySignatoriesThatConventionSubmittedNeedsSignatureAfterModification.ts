import { values } from "ramda";
import {
  type AbsoluteUrl,
  type AgencyWithUsersRights,
  type ConventionDto,
  executeInSequence,
  filterNotFalsy,
  getDisplayedBusinessName,
  getFormattedFirstnameAndLastname,
  type Signatory,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { GenerateVisitorOtpUrl } from "../../../../config/bootstrap/magicLinkUrl";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { retrieveConventionWithAgency } from "../../entities/Convention";

export const NO_JUSTIFICATION = "Aucune justification trouvée.";

export type NotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification =
  ReturnType<
    typeof makeNotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification
  >;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  generateVisitorOtpUrl: GenerateVisitorOtpUrl;
  timeGateway: TimeGateway;
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
      const now = deps.timeGateway.now();
      await executeInSequence(
        values(conventionReadDto.signatories)
          .filter(filterNotFalsy)
          .filter((signatory) => !signatory.signedAt),
        async (signatory) =>
          deps.saveNotificationAndRelatedEvent(uow, {
            kind: "email",
            templatedContent: makeEmail({
              signatory,
              convention: conventionReadDto,
              agency,
              conventionSignatureLink: deps.generateVisitorOtpUrl({
                conventionId: conventionReadDto.id,
                role: signatory.role,
                email: signatory.email,
                now,
                targetRoute: "manageConvention",
              }),
            }),
            followedIds: {
              conventionId: conventionReadDto.id,
              agencyId: conventionReadDto.agencyId,
              establishmentSiret: conventionReadDto.siret,
            },
          }),
      );
    });

const makeEmail = ({
  signatory,
  convention,
  agency,
  conventionSignatureLink,
}: {
  signatory: Signatory;
  convention: ConventionDto;
  agency: AgencyWithUsersRights;
  conventionSignatureLink: AbsoluteUrl;
}): TemplatedEmail => ({
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
    businessName: getDisplayedBusinessName(convention),
    conventionId: convention.id,
    conventionSignatureLink,
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
