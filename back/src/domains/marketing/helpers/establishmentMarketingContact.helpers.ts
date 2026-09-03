import { errors, type SiretDto } from "shared";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import type { EstablishmentMarketingGateway } from "../ports/EstablishmentMarketingGateway";

export const deleteEstablishmentMarketingContact = async ({
  uow,
  establishmentMarketingGateway,
  siret,
  throwIfMissing,
}: {
  uow: UnitOfWork;
  establishmentMarketingGateway: EstablishmentMarketingGateway;
  siret: SiretDto;
  throwIfMissing: boolean;
}): Promise<void> => {
  const establishmentMarketingContactEntity =
    await uow.establishmentMarketingRepository.getBySiret(siret);

  if (!establishmentMarketingContactEntity) {
    if (throwIfMissing) throw errors.establishmentMarketing.notFound({ siret });
    return;
  }

  await uow.establishmentMarketingRepository.delete(siret);
  await establishmentMarketingGateway.delete(
    establishmentMarketingContactEntity.contactEmail,
  );
};
