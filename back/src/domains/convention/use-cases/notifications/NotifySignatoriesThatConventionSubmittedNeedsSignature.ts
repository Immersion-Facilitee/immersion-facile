import { values } from "ramda";
import {
  type AgencyDto,
  type ConventionDto,
  errors,
  filterNotFalsy,
  getFormattedFirstnameAndLastname,
  type Signatory,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import type { GenerateConventionMagicLinkUrl } from "../../../../config/bootstrap/magicLinkUrl";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { CreateConventionMagicLinkPayloadProperties } from "../../../../utils/jwt";
import { createLogger } from "../../../../utils/logger";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { ShortLinkIdGeneratorGateway } from "../../../core/short-link/ports/ShortLinkIdGeneratorGateway";
import { prepareConventionMagicShortLinkMaker } from "../../../core/short-link/ShortLink";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

const logger = createLogger(__filename);

export type NotifySignatoriesThatConventionSubmittedNeedsSignature = ReturnType<
  typeof makeNotifySignatoriesThatConventionSubmittedNeedsSignature
>;

type Deps = {
  timeGateway: TimeGateway;
  shortLinkIdGeneratorGateway: ShortLinkIdGeneratorGateway;
  generateConventionMagicLinkUrl: GenerateConventionMagicLinkUrl;
  config: AppConfig;
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
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

      for (const signatory of values(convention.signatories).filter(
        filterNotFalsy,
      )) {
        await deps.saveNotificationAndRelatedEvent(uow, {
          kind: "email",
          templatedContent: await makeEmail(
            signatory,
            convention,
            await agencyWithRightToAgencyDto(uow, agencyWithRights),
            uow,
            deps,
          ),
          followedIds: {
            conventionId: convention.id,
            agencyId: convention.agencyId,
            establishmentSiret: convention.siret,
          },
        });
      }
    });

const makeEmail = async (
  signatory: Signatory,
  convention: ConventionDto,
  agency: AgencyDto,
  uow: UnitOfWork,
  {
    config,
    generateConventionMagicLinkUrl,
    shortLinkIdGeneratorGateway,
    timeGateway,
  }: Deps,
): Promise<TemplatedEmail> => {
  const {
    id,
    businessName,
    signatories: {
      beneficiary,
      beneficiaryRepresentative,
      establishmentRepresentative,
      beneficiaryCurrentEmployer,
    },
  } = convention;

  const conventionMagicLinkPayload: CreateConventionMagicLinkPayloadProperties =
    {
      id,
      role: signatory.role,
      email: signatory.email,
      now: timeGateway.now(),
    };

  const makeMagicShortLink = prepareConventionMagicShortLinkMaker({
    conventionMagicLinkPayload,
    uow,
    config,
    generateConventionMagicLinkUrl,
    shortLinkIdGeneratorGateway,
  });

  return {
    kind: "NEW_CONVENTION_CONFIRMATION_REQUEST_SIGNATURE",
    recipients: [signatory.email],
    params: {
      conventionId: convention.id,
      internshipKind: convention.internshipKind,
      signatoryName: getFormattedFirstnameAndLastname({
        firstname: signatory.firstName,
        lastname: signatory.lastName,
      }),
      beneficiaryName: getFormattedFirstnameAndLastname({
        firstname: beneficiary.firstName,
        lastname: beneficiary.lastName,
      }),
      establishmentTutorName: getFormattedFirstnameAndLastname({
        firstname: convention.establishmentTutor.firstName,
        lastname: convention.establishmentTutor.lastName,
      }),
      establishmentRepresentativeName: getFormattedFirstnameAndLastname({
        firstname: establishmentRepresentative.firstName,
        lastname: establishmentRepresentative.lastName,
      }),
      beneficiaryRepresentativeName:
        beneficiaryRepresentative &&
        getFormattedFirstnameAndLastname({
          firstname: beneficiaryRepresentative.firstName,
          lastname: beneficiaryRepresentative.lastName,
        }),
      beneficiaryCurrentEmployerName:
        beneficiaryCurrentEmployer &&
        getFormattedFirstnameAndLastname({
          lastname: beneficiaryCurrentEmployer.lastName,
          firstname: beneficiaryCurrentEmployer.firstName,
        }),
      conventionSignShortlink: await makeMagicShortLink({
        targetRoute: "conventionToSign",
        lifetime: "2Days",
        extraQueryParams: {
          at_campaign: "email-signature-link",
        },
      }),
      businessName,
      agencyLogoUrl: agency.logoUrl ?? undefined,
    },
  };
};
