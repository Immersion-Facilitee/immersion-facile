import {
  type AbsoluteUrl,
  type ConventionDto,
  type ConventionStatus,
  errors,
  executeInSequence,
  type WithSiretDto,
  withSiretSchema,
} from "shared";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { TimeGateway } from "../../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { notifyValidatorAndCounsellor } from "./notifications.utils";

const conventionStatusesBeforeValidation: ConventionStatus[] = [
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
    const { siret } = inputParams;
    const conventionsBeforeValidation =
      await uow.conventionQueries.getConventions({
        filters: {
          withSirets: [siret],
          withStatuses: conventionStatusesBeforeValidation,
        },
        sortBy: "dateStart",
      });

    const isEstablishmentBanned =
      await uow.bannedEstablishmentRepository.getBannedEstablishmentBySiret(
        siret,
      );
    if (!isEstablishmentBanned)
      throw errors.establishment.establishmentNotBanned({
        siret,
      });

    await executeInSequence(conventionsBeforeValidation, (convention) =>
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
          withSirets: [siret],
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
        convention.businessName,
      );
    });
  });

const notifyBeneficiaryAndEstablishmentRepresentative = async (
  uow: UnitOfWork,
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent,
  immersionBaseUrl: AbsoluteUrl,
  convention: ConventionDto,
) => {
  const isEstablishmentAlreadyRegistered =
    await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
      convention.siret,
    );
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

  if (!isEstablishmentAlreadyRegistered) {
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
  }
};
