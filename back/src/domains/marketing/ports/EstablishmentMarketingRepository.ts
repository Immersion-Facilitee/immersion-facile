import type { Email, NafCode, SiretDto } from "shared";
import type { MarketingContact } from "../entities/MarketingContact";

export type EstablishmentMarketingContactEntity = {
  contactEmail: Email;
  siret: SiretDto;
  nafCode: NafCode | null;
  emailContactHistory: MarketingContact[];
};

export type EstablishmentMarketingRepository = {
  delete(siret: SiretDto): Promise<void>;
  save(
    marketingEstablishmentContact: EstablishmentMarketingContactEntity,
  ): Promise<void>;

  getBySiret(
    siret: SiretDto,
  ): Promise<EstablishmentMarketingContactEntity | undefined>;

  getSiretsByContactEmail(email: Email): Promise<SiretDto[]>;
};
