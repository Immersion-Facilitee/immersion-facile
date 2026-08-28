import { expectToEqual } from "shared";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { InMemoryEstablishmentMarketingGateway } from "../adapters/establishmentMarketingGateway/InMemoryEstablishmentMarketingGateway";
import type { EstablishmentMarketingContactEntity } from "../ports/EstablishmentMarketingRepository";
import {
  type DeleteEstablishmentMarketingContact,
  makeDeleteEstablishmentMarketingContact,
} from "./DeleteEstablishmentMarketingContact";

describe("DeleteEstablishmentMarketingContact", () => {
  const siret = "12345678901234";
  const contactEmail = "marketing-contact@example.com";

  let uow: InMemoryUnitOfWork;
  let marketingGateway: InMemoryEstablishmentMarketingGateway;
  let deleteEstablishmentMarketingContact: DeleteEstablishmentMarketingContact;

  beforeEach(() => {
    uow = createInMemoryUow();
    marketingGateway = new InMemoryEstablishmentMarketingGateway();
    deleteEstablishmentMarketingContact =
      makeDeleteEstablishmentMarketingContact({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: { establishmentMarketingGateway: marketingGateway },
      });
  });

  it("does nothing when no marketing contact exists for the siret", async () => {
    await deleteEstablishmentMarketingContact.execute({ siret });

    expectToEqual(uow.establishmentMarketingRepository.contacts, []);
    expectToEqual(marketingGateway.marketingEstablishments, []);
  });

  it("removes the marketing contact from the repository and the gateway", async () => {
    const contactEntity: EstablishmentMarketingContactEntity = {
      contactEmail,
      siret,
      nafCode: null,
      emailContactHistory: [
        {
          createdAt: new Date("2024-01-01"),
          email: contactEmail,
          firstName: "John",
          lastName: "Doe",
        },
      ],
    };
    uow.establishmentMarketingRepository.contacts = [contactEntity];
    marketingGateway.marketingEstablishments = [
      {
        siret,
        email: contactEmail,
        firstName: "John",
        lastName: "Doe",
        conventions: { numberOfValidatedConvention: 1 },
        hasIcAccount: false,
        isRegistered: false,
      },
    ];

    await deleteEstablishmentMarketingContact.execute({ siret });

    expectToEqual(uow.establishmentMarketingRepository.contacts, []);
    expectToEqual(marketingGateway.marketingEstablishments, []);
  });
});
