import { errors, getDisplayedBusinessName, withConventionSchema } from "shared";
import { agencyWithRightToAgencyDto } from "../../../../utils/agency";
import type { SaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { useCaseBuilder } from "../../../core/useCaseBuilder";
import { getAllConventionRecipientsEmail } from "../../entities/Convention";

export type NotifyAllActorsThatConventionIsDeprecated = ReturnType<
  typeof makeNotifyAllActorsThatConventionIsDeprecated
>;

type Deps = {
  saveNotificationAndRelatedEvent: SaveNotificationAndRelatedEvent;
};

export const makeNotifyAllActorsThatConventionIsDeprecated = useCaseBuilder(
  "NotifyAllActorsThatConventionIsDeprecated",
)
  .withInput(withConventionSchema)
  .withDeps<Deps>()
  .build(async ({ inputParams: { convention }, uow, deps }) => {
    const [agency] = await uow.agencyRepository.getByIds([convention.agencyId]);
    if (!agency)
      throw errors.agency.notFound({ agencyId: convention.agencyId });

    const { beneficiary } = convention.signatories;

    const recipients = getAllConventionRecipientsEmail(
      convention,
      await agencyWithRightToAgencyDto(uow, agency),
    );

    await deps.saveNotificationAndRelatedEvent(uow, {
      kind: "email",
      templatedContent: {
        kind: "DEPRECATED_CONVENTION_NOTIFICATION",
        recipients,
        params: {
          conventionId: convention.id,
          internshipKind: convention.internshipKind,
          beneficiaryFirstName: beneficiary.firstName,
          beneficiaryLastName: beneficiary.lastName,
          businessName: getDisplayedBusinessName(convention),
          deprecationReason: convention.statusJustification || "",
          dateStart: convention.dateStart,
          dateEnd: convention.dateEnd,
          immersionProfession: convention.immersionAppellation.appellationLabel,
        },
      },
      followedIds: {
        conventionId: convention.id,
        agencyId: convention.agencyId,
        establishmentSiret: convention.siret,
      },
    });
  });
