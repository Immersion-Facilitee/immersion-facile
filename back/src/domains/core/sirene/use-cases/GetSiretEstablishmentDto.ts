import {
  errors,
  type GetSiretRequestDto,
  getSiretRequestSchema,
  type SiretEstablishmentDto,
} from "shared";
import { useCaseBuilder } from "../../useCaseBuilder";
import { getSiretEstablishmentFromApi } from "../helpers/getSirenEstablishmentFromApi";
import type { SiretGateway } from "../ports/SiretGateway";

export type GetSiretEstablishmentDto = ReturnType<
  typeof makeGetSiretEstablishmentDto
>;

export const makeGetSiretEstablishmentDto = useCaseBuilder(
  "GetSiretEstablishmentDto",
)
  .withInput<GetSiretRequestDto>(getSiretRequestSchema)
  .withOutput<SiretEstablishmentDto | null>()
  .withDeps<{ siretGateway: SiretGateway }>()
  .build(async ({ inputParams, deps, uow }) => {
    const { siret } = inputParams;
    if (
      await uow.bannedEstablishmentRepository.getBannedEstablishmentBySiret(
        siret,
      )
    ) {
      throw errors.establishment.bannedEstablishment({
        siret,
      });
    }
    const establishmentFromApi = await getSiretEstablishmentFromApi(
      inputParams,
      deps.siretGateway,
    );

    if (!establishmentFromApi) return null;

    const establishmentAggregate =
      await uow.establishmentAggregateRepository.getEstablishmentAggregateBySiret(
        inputParams.siret,
      );

    const isAlreadySaved = !!establishmentAggregate;
    const businessNameCustomized =
      establishmentAggregate?.establishment.customizedName;

    return {
      ...establishmentFromApi,
      ...(businessNameCustomized && { businessNameCustomized }),
      isAlreadySaved,
    };
  });
