import type { GetSiretRequestDto } from "shared";
import type {
  SiretEstablishmentResponseDto,
  SiretGateway,
} from "../ports/SiretGateway";

export const getSiretEstablishmentFromApi = async (
  { siret, includeClosedEstablishments }: GetSiretRequestDto,
  siretGateway: SiretGateway,
): Promise<SiretEstablishmentResponseDto | null> => {
  const siretEstablishment = await siretGateway.getEstablishmentBySiret(
    siret,
    includeClosedEstablishments,
  );

  return siretEstablishment ?? null;
};
