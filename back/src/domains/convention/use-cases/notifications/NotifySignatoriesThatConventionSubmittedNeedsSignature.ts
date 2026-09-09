import { values } from "ramda";
import {
  type AgencyDto,
  type ConventionDto,
  errors,
  filterNotFalsy,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
  type Signatory,
  type TemplatedEmail,
  withConventionSchema,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import { createLogger } from "../../../../utils/logger";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

const logger = createLogger(__filename);

export type NotifySignatoriesThatConventionSubmittedNeedsSignature = ReturnType<
  typeof makeNotifySignatoriesThatConventionSubmittedNeedsSignature
>;

type Deps = {
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
          templatedContent: makeEmail(
            signatory,
            convention,
            await agencyWithRightToAgencyDto(uow, agencyWithRights),
            deps.config,
          ),
          followedIds: {
            conventionId: convention.id,
            agencyId: convention.agencyId,
            establishmentSiret: convention.siret,
          },
        });
      }
    });

const makeEmail = (
  signatory: Signatory,
  convention: ConventionDto,
  agency: AgencyDto,
  config: AppConfig,
): TemplatedEmail => {
  const {
    businessName,
    signatories: {
      beneficiary,
      beneficiaryRepresentative,
      establishmentRepresentative,
      beneficiaryCurrentEmployer,
    },
  } = convention;

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
      conventionSignatureLink: makeRouteAbsoluteUrl({
        route: frontRoutes.manageConventionConnectedUser({
          conventionId: convention.id,
          loginPersona:
            signatory.role === "establishment-representative"
              ? "professional"
              : "beneficiary",
          at_campaign: "email-signature-link",
        }),
        baseUrl: config.immersionFacileBaseUrl,
      }),
      businessName,
      agencyLogoUrl: agency.logoUrl ?? undefined,
    },
  };
};
