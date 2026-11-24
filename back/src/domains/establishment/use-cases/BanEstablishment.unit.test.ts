import {
  type BanEstablishmentPayload,
  type ConnectedUser,
  ConnectedUserBuilder,
  expectArraysToEqual,
  expectArraysToMatch,
} from "shared";
import {
  type CreateNewEvent,
  makeCreateNewEvent,
} from "../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type BanEstablishment,
  makeBanEstablishment,
} from "./BanEstablishment";

describe("BanEstablishment", () => {
  let uow: InMemoryUnitOfWork;
  let uowPerformer: InMemoryUowPerformer;
  let createNewEvent: CreateNewEvent;
  let banEstablishment: BanEstablishment;

  const connectedNonAdminUser: ConnectedUser =
    new ConnectedUserBuilder().build();
  const connectedAdminUser: ConnectedUser = new ConnectedUserBuilder()
    .withIsAdmin(true)
    .build();

  const bannedEstablishment: BanEstablishmentPayload = {
    siret: "12345678901234",
    establishmentBannishmentJustification: "Le cidre n'est pas breton",
  };

  beforeEach(() => {
    const timeGateway = new CustomTimeGateway();
    const uuidGenerator = new TestUuidGenerator();

    uow = createInMemoryUow();
    uowPerformer = new InMemoryUowPerformer(uow);
    createNewEvent = makeCreateNewEvent({ timeGateway, uuidGenerator });
    banEstablishment = makeBanEstablishment({
      uowPerformer,
      deps: { createNewEvent },
    });
  });

  it("bans an establishment", async () => {
    await banEstablishment.execute(
      {
        siret: bannedEstablishment.siret,
        establishmentBannishmentJustification:
          bannedEstablishment.establishmentBannishmentJustification,
      },
      connectedAdminUser,
    );

    expectArraysToEqual(
      uow.bannedEstablishmentRepository.bannedEstablishments,
      [bannedEstablishment],
    );

    expectArraysToMatch(uow.outboxRepository.events, [
      {
        topic: "EstablishmentBanned",
        payload: {
          siret: bannedEstablishment.siret,
          triggeredBy: {
            kind: "connected-user",
            userId: connectedAdminUser.id,
          },
        },
      },
    ]);
  });

  it("throws if establishment is already banned", async () => {
    uow.bannedEstablishmentRepository.bannedEstablishments = [
      bannedEstablishment,
    ];

    await expect(
      banEstablishment.execute(
        {
          siret: bannedEstablishment.siret,
          establishmentBannishmentJustification:
            bannedEstablishment.establishmentBannishmentJustification,
        },
        connectedAdminUser,
      ),
    ).rejects.toThrow(
      `L'entreprise avec le siret '${bannedEstablishment.siret}' est déjà bannie.`,
    );

    expectArraysToMatch(uow.outboxRepository.events, []);
  });

  it("throws if the user is not a back office admin", async () => {
    await expect(
      banEstablishment.execute(
        {
          siret: bannedEstablishment.siret,
          establishmentBannishmentJustification:
            bannedEstablishment.establishmentBannishmentJustification,
        },
        connectedNonAdminUser,
      ),
    ).rejects.toThrow(
      `L'utilisateur qui a l'identifiant "${connectedNonAdminUser.id}" n'a pas le droit d'accéder à cette ressource.`,
    );

    expectArraysToMatch(uow.outboxRepository.events, []);
  });
});
