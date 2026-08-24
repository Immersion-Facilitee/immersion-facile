import { values } from "ramda";
import {
  type AgencyWithUsersRights,
  type ConventionDto,
  executeInSequence,
  filterNotFalsy,
  getFormattedFirstnameAndLastname,
  type Signatory,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { GenerateConventionMagicLinkUrl } from "../../../../config/bootstrap/magicLinkUrl";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { ShortLinkIdGeneratorGateway } from "../../../core/short-link/ports/ShortLinkIdGeneratorGateway";
import { prepareConventionMagicShortLinkMaker } from "../../../core/short-link/ShortLink";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { retrieveConventionWithAgency } from "../../entities/Convention";

export const NO_JUSTIFICATION = "Aucune justification trouvée.";

export type NotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification =
  ReturnType<
    typeof makeNotifySignatoriesThatConventionSubmittedNeedsSignatureAfterModification
  >;

type Deps = {
  timeGateway: TimeGateway;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  config: AppConfig;
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
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
            templatedContent: await makeEmail(
              signatory,
              conventionReadDto,
              agency,
              uow,
              deps,
            ),
            followedIds: {
              conventionId: conventionReadDto.id,
              agencyId: conventionReadDto.agencyId,
              establishmentSiret: conventionReadDto.siret,
            },
          }),
      );
    });

const makeEmail = async (
  signatory: Signatory,
  convention: ConventionDto,
  agency: AgencyWithUsersRights,
  uow: UnitOfWork,
  {
    timeGateway,
    config,
    generateConventionMagicLinkUrl,
    shortLinkIdGeneratorGateway,
  }: Deps,
): Promise<TemplatedEmail> => ({
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
    conventionSignShortlink: await prepareConventionMagicShortLinkMaker({
      conventionMagicLinkPayload: {
        id: convention.id,
        role: signatory.role,
        email: signatory.email,
        now: timeGateway.now(),
      },
      uow,
      config,
      generateConventionMagicLinkUrl,
      shortLinkIdGeneratorGateway,
    })({
      targetRoute: "conventionToSign",
      lifetime: "2Days",
      extraQueryParams: {
        at_campaign: "email-signature-link-after-modification",
      },
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
