import type { Email, SiretDto } from "shared";
import type {
  EstablishmentMarketingContactEntity,
  EstablishmentMarketingRepository,
} from "../ports/EstablishmentMarketingRepository";

export class InMemoryEstablishementMarketingRepository
  implements EstablishmentMarketingRepository
{
  async delete(siret: SiretDto): Promise<void> {
    this.contacts = this.contacts.filter((contact) => contact.siret !== siret);
  }

  async getBySiret(
    siret: SiretDto,
  ): Promise<EstablishmentMarketingContactEntity | undefined> {
    return this.#contacts[siret];
  }

  async getSiretsByContactEmail(email: Email): Promise<SiretDto[]> {
    return this.contacts
      .filter((contact) => contact.contactEmail === email)
      .map(({ siret }) => siret);
  }

  async save(
    marketingEstablishmentContact: EstablishmentMarketingContactEntity,
  ): Promise<void> {
    this.#contacts = {
      ...this.#contacts,
      [marketingEstablishmentContact.siret]: marketingEstablishmentContact,
    };
  }

  #contacts: Record<SiretDto, EstablishmentMarketingContactEntity> = {};

  public get contacts(): EstablishmentMarketingContactEntity[] {
    return Object.values(this.#contacts);
  }

  public set contacts(contact: EstablishmentMarketingContactEntity[]) {
    this.#contacts = contact.reduce(
      (acc, contact) => ({
        ...acc,
        [contact.siret]: contact,
      }),
      {} as Record<SiretDto, EstablishmentMarketingContactEntity>,
    );
  }
}
