import { values } from "ramda";
import {
  type AbsoluteUrl,
  type AgencyDto,
  type ConventionDto,
  errors,
  filterNotFalsy,
  getFormattedFirstnameAndLastname,
  type Signatory,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { GenerateVisitorOtpUrl } from "../../../../config/bootstrap/magicLinkUrl";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import { createLogger } from "../../../../utils/logger";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

const logger = createLogger(__filename);

export type NotifySignatoriesThatConventionSubmittedNeedsSignature = ReturnType<
  typeof makeNotifySignatoriesThatConventionSubmittedNeedsSignature
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  generateVisitorOtpUrl: GenerateVisitorOtpUrl;
  timeGateway: TimeGateway;
};

export const makeNotifySignatoriesThatConventionSubmittedNeedsSignature =
  useCaseBuilder("NotifySignatoriesThatConventionSubmittedNeedsSignature")
    .withInput(withConventionSchema)
    .withDeps<Deps>()
    .build(async ({ inputParams: { convention }, uow, deps }) => {
      if (convention.status === "PARTIALLY_SIGNED") {
        logger.info({
          message:
            "Skipping sending signature-requiring establishment representative confirmation as convention is already partially signed",
        });
        return;
      }

      const [agencyWithRights] = await uow.agencyRepository.getByIds([
        convention.agencyId,
      ]);
      if (!agencyWithRights)
        throw errors.agency.notFound({ agencyId: convention.agencyId });

      const now = deps.timeGateway.now();

      for (const signatory of values(convention.signatories).filter(
        filterNotFalsy,
      )) {
        await deps.saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent: makeEmail({
            signatory,
            convention,
            agency: await agencyWithRightToAgencyDto(uow, agencyWithRights),
            conventionSignatureLink: deps.generateVisitorOtpUrl({
              conventionId: convention.id,
              role: signatory.role,
              email: signatory.email,
              now,
              targetRoute: "manageConvention",
            }),
          }),
          followedIds: {
            conventionId: convention.id,
            agencyId: convention.agencyId,
            establishmentSiret: convention.siret,
          },
        });
      }
    });

const makeEmail = ({
  signatory,
  convention,
  agency,
  conventionSignatureLink,
}: {
  signatory: Signatory;
  convention: ConventionDto;
  agency: AgencyDto;
  conventionSignatureLink: AbsoluteUrl;
}): TemplatedEmail => ({
  kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
  recipients: [signatory.email],
  params: {
    conventionId: convention.id,
    internshipKind: convention.internshipKind,
    signatoryName: getFormattedFirstnameAndLastname({
      firstname: signatory.firstName,
      lastname: signatory.lastName,
    }),
    signatoryEmail: signatory.email,
    beneficiaryName: getFormattedFirstnameAndLastname({
      firstname: convention.signatories.beneficiary.firstName,
      lastname: convention.signatories.beneficiary.lastName,
    }),
    conventionSignatureLink,
    agencyLogoUrl: agency.logoUrl ?? undefined,
    renewed: convention.renewed,
  },
});
