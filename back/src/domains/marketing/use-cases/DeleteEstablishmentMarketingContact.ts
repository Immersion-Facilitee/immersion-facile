import { type WithSiretDto, withSiretSchema } from "shared";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { deleteEstablishmentMarketingContact } from "../helpers/establishmentMarketingContact.helpers";
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
    await deleteEstablishmentMarketingContact({
      uow,
      establishmentMarketingGateway: deps.establishmentMarketingGateway,
      siret,
      throwIfMissing: false,
    });
  });
