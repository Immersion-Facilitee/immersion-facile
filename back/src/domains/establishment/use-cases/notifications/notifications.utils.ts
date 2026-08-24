import { uniq } from "ramda";
import { type AbsoluteUrl, type ConventionDto, errors } from "shared";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { ConventionFtUserAdvisorEntity } from "../../../core/authentication/ft-connect/dto/FtConnect.dto";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import type { UnitOfWork } from "../../../core/unit-of-work/ports/UnitOfWork";

export const notifyValidatorAndCounsellor = async (
  uow: UnitOfWork,
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent,
  immersionBaseUrl: AbsoluteUrl,
  convention: ConventionDto,
  businessName: string,
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
        businessName,
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
