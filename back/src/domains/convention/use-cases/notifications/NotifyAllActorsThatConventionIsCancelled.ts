import {
  errors,
  getDisplayedBusinessName,
  getFormattedFirstnameAndLastname,
  withConventionSchema,
} from "shared";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { getAllConventionRecipientsEmail } from "../../entities/Convention";

export type NotifyAllActorsThatConventionIsCancelled = ReturnType<
  typeof makeNotifyAllActorsThatConventionIsCancelled
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
};

export const makeNotifyAllActorsThatConventionIsCancelled = useCaseBuilder(
  "NotifyAllActorsThatConventionIsCancelled",
)
  .withInput(withConventionSchema)
  .withDeps<Deps>()
  .build(async ({ inputParams: { convention }, uow, deps }) => {
    const [agency] = await uow.agencyRepository.getByIds([convention.agencyId]);
    if (!agency)
      throw errors.agency.notFound({ agencyId: convention.agencyId });

    const beneficiary = convention.signatories.beneficiary;

    const recipients = getAllConventionRecipientsEmail(
      convention,
      await agencyWithRightToAgencyDto(uow, agency),
    );

    await deps.saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "CANCELLED_CONVENTION_NOTIFICATION",
        recipients,
        params: {
          agencyName: agency.name,
          conventionId: convention.id,
          internshipKind: convention.internshipKind,
          beneficiaryFirstName: getFormattedFirstnameAndLastname({
            firstname: beneficiary.firstName,
          }),
          beneficiaryLastName: getFormattedFirstnameAndLastname({
            lastname: beneficiary.lastName,
          }),
          businessName: getDisplayedBusinessName(convention),
          signature: agency.signature,
          immersionProfession: convention.immersionAppellation.appellationLabel,
          agencyLogoUrl: agency.logoUrl ?? undefined,
          dateEnd: convention.dateEnd,
          dateStart: convention.dateStart,
          justification: convention.statusJustification || "non renseigné",
        },
      },
      followedIds: {
        conventionId: convention.id,
        agencyId: convention.agencyId,
        establishmentSiret: convention.siret,
      },
    });
  });
