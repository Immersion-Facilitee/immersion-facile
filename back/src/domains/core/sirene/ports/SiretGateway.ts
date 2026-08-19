import type { SiretDto, SiretEstablishmentDto } from "shared";

export type EstablishmentsFromSiretApi = Partial<
  Record<SiretDto, SiretEstablishmentResponseDto>
>;

export type SiretEstablishmentResponseDto = Omit<
  SiretEstablishmentDto,
  "isAlreadySaved"
>;

export interface SiretGateway {
  getEstablishmentBySiret(
    siret: SiretDto,
    includeClosedEstablishments?: boolean,
  ): Promise<SiretEstablishmentResponseDto | undefined>;
  getEstablishmentUpdatedBetween(
    fromDate: Date,
    toDate: Date,
    sirets: SiretDto[],
  ): Promise<EstablishmentsFromSiretApi>;
}
