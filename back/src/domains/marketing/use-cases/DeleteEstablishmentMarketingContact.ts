import { type WithSiretDto, withSiretSchema } from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { EstablishmentMarketingGateway } from "../ports/EstablishmentMarketingGateway";

export type DeleteEstablishmentMarketingContact = ReturnType<
  typeof makeDeleteEstablishmentMarketingContact
>;

export const makeDeleteEstablishmentMarketingContact = useCaseBuilder(
  "DeleteEstablishmentMarketingContact",
)
  .withInput<WithSiretDto>(withSiretSchema)
  .withOutput<void>()
  .withCurrentUser<void>()
  .withDeps<{
    establishmentMarketingGateway: EstablishmentMarketingGateway;
  }>()
  .build(async ({ inputParams: { siret }, deps, uow }) => {
    const establishmentMarketingContactEntity =
      await uow.establishmentMarketingRepository.getBySiret(siret);

    if (!establishmentMarketingContactEntity) return;

    await uow.establishmentMarketingRepository.delete(siret);
    await deps.establishmentMarketingGateway.delete(
      establishmentMarketingContactEntity.contactEmail,
    );
  });
