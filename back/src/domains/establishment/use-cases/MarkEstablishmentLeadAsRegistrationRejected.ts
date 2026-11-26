import { type ConventionDomainJwtPayload, errors } from "shared";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { EstablishmentLead } from "../entities/EstablishmentLeadEntity";

export type MarkEstablishmentLeadAsRegistrationRejected = ReturnType<
  typeof makeMarkEstablishmentLeadAsRegistrationRejected
>;

export const makeMarkEstablishmentLeadAsRegistrationRejected = useCaseBuilder(
  "MarkEstablishmentLeadAsRegistrationRejected",
)
  .withCurrentUser<ConventionDomainJwtPayload>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(async ({ uow, currentUser, deps: { timeGateway } }) => {
    const convention = await uow.conventionRepository.getById(
      currentUser.applicationId,
    );

    if (!convention)
      throw errors.convention.notFound({
        conventionId: currentUser.applicationId,
      });

    const establishmentLead = await uow.establishmentLeadRepository.getBySiret(
      convention.siret,
    );

    if (!establishmentLead)
      throw errors.establishmentLead.notFound({ siret: convention.siret });

    if (establishmentLead.lastEventKind === "registration-refused") return;

    const { siret, events } = establishmentLead;
    const updatedEstablishmentLead: EstablishmentLead = {
      siret,
      lastEventKind: "registration-refused",
      events: [
        ...events,
        { kind: "registration-refused", occurredAt: timeGateway.now() },
      ],
    };

    await uow.establishmentLeadRepository.save(updatedEstablishmentLead);
  });
