import { uniq, uniqBy } from "ramda";
import {
  type AgencyDto,
  type ConventionDto,
  type ConventionRole,
  type Email,
  errors,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  makeRouteAbsoluteUrl,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { TransferConventionToAgencyPayload } from "../../../core/events/eventPayload.dto";
import { transferConventionToAgencyPayloadSchema } from "../../../core/events/eventPayload.schema";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
export type NotifyAllActorsThatConventionTransferred = ReturnType<
  typeof makeNotifyAllActorsThatConventionTransferred
>;

export const makeNotifyAllActorsThatConventionTransferred = useCaseBuilder(
  "NotifyAllActorsThatConventionTransferred",
)
  .withInput<TransferConventionToAgencyPayload>(
    transferConventionToAgencyPayloadSchema,
  )
  .withOutput<void>()
  .withCurrentUser<void>()
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    config: AppConfig;
  }>()
  .build(async ({ inputParams, uow, deps }) => {
    if (!inputParams.shouldNotifyActors) return;

    const {
      agencyId,
      convention: transferredConvention,
      justification,
      previousAgencyId,
    } = inputParams;

    const previousAgency = await uow.agencyRepository.getById(previousAgencyId);
    if (!previousAgency) {
      throw errors.agency.notFound({ agencyId: previousAgencyId });
    }

    const agencyWithRights = await uow.agencyRepository.getById(agencyId);
    if (!agencyWithRights) {
      throw errors.agency.notFound({ agencyId });
    }

    const agency = await agencyWithRightToAgencyDto(uow, agencyWithRights);

    const convention = await uow.conventionRepository.getById(
      transferredConvention.id,
    );
    if (!convention) {
      throw errors.convention.notFound({
        conventionId: transferredConvention.id,
      });
    }

    const signatoriesRecipientsRoleAndEmail: {
      role: ConventionRole;
      email: Email;
    }[] = uniqBy(
      (recipient) => recipient.email,
      [
        ...Object.values(convention.signatories).map((signatory) => ({
          role: signatory.role,
          email: signatory.email,
        })),
        ...(convention.signatories.establishmentRepresentative.email !==
        convention.establishmentTutor.email
          ? [
              {
                role: convention.establishmentTutor.role,
                email: convention.establishmentTutor.email,
              },
            ]
          : []),
      ],
    );

    const agencyCounsellorsAndValidatorsEmails: Email[] = uniq([
      ...agency.counsellorEmails,
      ...agency.validatorEmails,
    ]);

    await sendAgencyEmails({
      agencyCounsellorsAndValidatorsEmails,
      convention,
      uow,
      justification,
      previousAgencyName: previousAgency.name,
      saveNotificationAndRelatedEvent: deps.saveNotificationAndRelatedEvent,
      config: deps.config,
    });
    await sendSignatoriesEmail(
      signatoriesRecipientsRoleAndEmail,
      convention,
      uow,
      justification,
      agency,
      previousAgency.name,
      {
        config: deps.config,
        saveNotificationAndRelatedEvent: deps.saveNotificationAndRelatedEvent,
      },
    );
  });

const sendAgencyEmails = async ({
  agencyCounsellorsAndValidatorsEmails,
  convention,
  uow,
  justification,
  previousAgencyName,
  config,
  saveNotificationAndRelatedEvent,
}: {
  agencyCounsellorsAndValidatorsEmails: Email[];
  convention: ConventionDto;
  uow: UnitOfWork;
  justification: string;
  previousAgencyName: string;
  config: AppConfig;
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
}) => {
  for (const email of agencyCounsellorsAndValidatorsEmails)
    await saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "CONVENTION_TRANSFERRED_AGENCY_NOTIFICATION",
        recipients: [email],
        params: {
          internshipKind: convention.internshipKind,
          beneficiaryEmail: convention.signatories.beneficiary.email,
          beneficiaryFirstName: getFormattedFirstnameAndLastname({
            firstname: convention.signatories.beneficiary.firstName,
          }),
          beneficiaryLastName: getFormattedFirstnameAndLastname({
            lastname: convention.signatories.beneficiary.lastName,
          }),
          beneficiaryPhone: convention.signatories.beneficiary.phone,
          previousAgencyName,
          justification,
          manageConventionLink: makeRouteAbsoluteUrl({
            route: frontRoutes.manageConventionConnectedUser({
              conventionId: convention.id,
            }),
            baseUrl: config.immersionFacileBaseUrl,
          }),
          conventionId: convention.id,
        },
      },
      followedIds: {
        conventionId: convention.id,
        agencyId: convention.agencyId,
        establishmentSiret: convention.siret,
      },
    });
};

const sendSignatoriesEmail = async (
  signatoriesRecipientsRoleAndEmail: { role: ConventionRole; email: Email }[],
  convention: ConventionDto,
  uow: UnitOfWork,
  justification: string,
  agency: AgencyDto,
  previousAgencyName: string,
  deps: {
    config: AppConfig;
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
  },
) => {
  for (const emailAndRole of signatoriesRecipientsRoleAndEmail) {
    const { role, email } = emailAndRole;
    const loginPersona =
      role === "beneficiary" ||
      role === "beneficiary-representative" ||
      role === "beneficiary-current-employer"
        ? "beneficiary"
        : "professional";

    await deps.saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "CONVENTION_TRANSFERRED_SIGNATORY_NOTIFICATION",
        recipients: [email],
        params: {
          internshipKind: convention.internshipKind,
          immersionProfession: convention.immersionAppellation.appellationLabel,
          newAgencyName: agency.name,
          agencyAddress: `${agency.address.streetNumberAndAddress} ${agency.address.postcode} ${agency.address.city}`,
          businessName: convention.businessName,
          justification,
          manageConventionLink: makeRouteAbsoluteUrl({
            route: frontRoutes.manageConventionConnectedUser({
              conventionId: convention.id,
              loginPersona,
            }),
            baseUrl: deps.config.immersionFacileBaseUrl,
          }),
          conventionId: convention.id,
          previousAgencyName,
        },
      },
      followedIds: {
        conventionId: convention.id,
        agencyId: convention.agencyId,
        establishmentSiret: convention.siret,
      },
    });
  }
};
