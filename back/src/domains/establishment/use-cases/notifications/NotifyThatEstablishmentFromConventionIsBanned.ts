import { uniq } from "ramda";
import {
  type AbsoluteUrl,
  type ConventionDto,
  type ConventionStatus,
  errors,
  executeInSequence,
  type WithSiretDto,
  withSiretSchema,
} from "shared";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { ConventionFtUserAdvisorEntity } from "../../../core/authentication/ft-connect/dto/FtConnect.dto";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";

const conventionStatusesToNotify: ConventionStatus[] = [
  "READY_TO_SIGN",
  "PARTIALLY_SIGNED",
  "IN_REVIEW",
  "ACCEPTED_BY_COUNSELLOR",
];

export type NotifyThatEstablishmentFromConventionIsBanned = ReturnType<
  typeof makeNotifyThatEstablishmentFromConventionIsBanned
>;

export const makeNotifyThatEstablishmentFromConventionIsBanned = useCaseBuilder(
  "NotifyThatEstablishmentFromConventionIsBanned",
)
  .withInput<WithSiretDto>(withSiretSchema)
  .withDeps<{
    saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
    immersionBaseUrl: AbsoluteUrl;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ uow, inputParams, deps }) => {
    const conventions = await uow.conventionQueries.getConventions({
      filters: {
        withSirets: [inputParams.siret],
        withStatuses: conventionStatusesToNotify,
      },
      sortBy: "dateStart",
    });

    await executeInSequence(conventions, (convention) =>
      notifyBeneficiaryAndEstablishmentRepresentative(
        uow,
        deps.saveNotificationAndRelatedEvent,
        deps.immersionBaseUrl,
        convention,
      ),
    );

    const now = deps.timeGateway.now();
    const ongoingValidatedConventions = (
      await uow.conventionQueries.getConventions({
        filters: {
          withSirets: [inputParams.siret],
          withStatuses: ["ACCEPTED_BY_VALIDATOR"],
          endDate: { from: now },
        },
        sortBy: "dateStart",
      })
    ).filter(({ dateEnd }) => new Date(dateEnd) > now);

    await executeInSequence(ongoingValidatedConventions, async (convention) => {
      await notifyBeneficiaryAndEstablishmentRepresentative(
        uow,
        deps.saveNotificationAndRelatedEvent,
        deps.immersionBaseUrl,
        convention,
      );
      await notifyValidatorAndCounsellor(
        uow,
        deps.saveNotificationAndRelatedEvent,
        deps.immersionBaseUrl,
        convention,
      );
    });
  });

const notifyBeneficiaryAndEstablishmentRepresentative = async (
  uow: UnitOfWork,
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent,
  immersionBaseUrl: AbsoluteUrl,
  convention: ConventionDto,
) => {
  await saveNotificationAndRelatedEvent(uow, {
    kind: "email",
    templatedContent: {
      kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_BENEFICIARY",
      recipients: [convention.signatories.beneficiary.email],
      params: {
        businessName: convention.businessName,
        beneficiaryFirstName: convention.signatories.beneficiary.firstName,
        beneficiaryLastName: convention.signatories.beneficiary.lastName,
        immersionBaseUrl,
      },
    },
    followedIds: {
      establishmentSiret: convention.siret,
      conventionId: convention.id,
    },
  });

  await saveNotificationAndRelatedEvent(uow, {
    kind: "email",
    templatedContent: {
      kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_ESTABLISHMENT_USERS",
      recipients: [convention.signatories.establishmentRepresentative.email],
      params: {
        businessName: convention.businessName,
        siret: convention.siret,
      },
    },
    followedIds: {
      establishmentSiret: convention.siret,
      conventionId: convention.id,
    },
  });
};

const notifyValidatorAndCounsellor = async (
  uow: UnitOfWork,
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent,
  immersionBaseUrl: AbsoluteUrl,
  convention: ConventionDto,
) => {
  const agency = await uow.agencyRepository.getById(convention.agencyId);
  if (!agency) throw errors.agency.notFound({ agencyId: convention.agencyId });

  const ftUserAdvisor: ConventionFtUserAdvisorEntity | undefined =
    await uow.conventionFranceTravailAdvisorRepository.getByConventionId(
      convention.id,
    );

  const recipients = ftUserAdvisor?.advisor
    ? [ftUserAdvisor.advisor.email]
    : await getAgencyValidatorAndCounsellorEmails(uow, agency);

  await saveNotificationAndRelatedEvent(uow, {
    kind: "email",
    templatedContent: {
      kind: "ESTABLISHMENT_BANNED_NOTIFICATION_TO_VALIDATOR_AND_PREVALIDATOR",
      recipients,
      params: {
        businessName: convention.businessName,
        beneficiaryFirstName: convention.signatories.beneficiary.firstName,
        beneficiaryLastName: convention.signatories.beneficiary.lastName,
        immersionBaseUrl,
        conventionId: convention.id,
      },
    },
    followedIds: {
      establishmentSiret: convention.siret,
      conventionId: convention.id,
    },
  });
};

const getAgencyValidatorAndCounsellorEmails = async (
  uow: UnitOfWork,
  agency: Parameters<typeof agencyWithRightToAgencyDto>[1],
) => {
  const agencyWithUserEmailNotificationActivated =
    await agencyWithRightToAgencyDto(uow, agency);

  return uniq([
    ...agencyWithUserEmailNotificationActivated.validatorEmails,
    ...agencyWithUserEmailNotificationActivated.counsellorEmails,
  ]);
};
