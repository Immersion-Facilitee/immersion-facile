import {
  type ArchivedConventionRequestDto,
  type ConnectedUser,
  ConnectedUserBuilder,
  expectArraysToMatch,
  expectToEqual,
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
  type CreateArchivedConventionRequest,
  makeCreateArchivedConventionRequest,
} from "./CreateArchivedConventionRequest";

describe("CreateArchivedConventionRequest", () => {
  let uow: InMemoryUnitOfWork;
  let createArchivedConventionRequest: CreateArchivedConventionRequest;
  let createNewEvent: CreateNewEvent;
  let timeGateway: CustomTimeGateway;

  const connectedUser: ConnectedUser = new ConnectedUserBuilder().build();
  const now = new Date("2024-06-01T12:00:00.000Z");
  const requestId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    timeGateway = new CustomTimeGateway(now);
    const uuidGenerator = new TestUuidGenerator();

    uow = createInMemoryUow();
    createNewEvent = makeCreateNewEvent({ timeGateway, uuidGenerator });
    createArchivedConventionRequest = makeCreateArchivedConventionRequest({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: { createNewEvent, timeGateway },
    });
  });

  it("saves an archived convention request with conventionSearchMethod = withConventionId", async () => {
    const input: ArchivedConventionRequestDto = {
      id: requestId,
      conventionSearchMethod: "withConventionId",
      conventionId: "22222222-2222-4222-8222-222222222222",
      reason: "legalDispute",
    };

    await createArchivedConventionRequest.execute(input, connectedUser);

    expectToEqual(
      uow.archivedConventionRequestRepository.archivedConventionRequests,
      {
        [requestId]: {
          ...input,
          userId: connectedUser.id,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          status: "PENDING",
        },
      },
    );

    expectArraysToMatch(uow.outboxRepository.events, [
      {
        topic: "ArchivedConventionRequestCreated",
        payload: {
          archivedConventionRequestId: requestId,
          triggeredBy: {
            kind: "connected-user",
            userId: connectedUser.id,
          },
        },
      },
    ]);
  });

  it("saves an archived convention request with conventionSearchMethod = withConventionDetails", async () => {
    const input: ArchivedConventionRequestDto = {
      id: requestId,
      conventionSearchMethod: "withConventionDetails",
      beneficiaryFirstName: "Jean",
      beneficiaryLastName: "Dupont",
      siret: "12345678901234",
      immersionDate: "2024-01-15",
      immersionAppellation: {
        appellationCode: "11573",
        appellationLabel: "Boulanger / Boulangère",
        romeCode: "D1102",
        romeLabel: "Boulangerie - viennoiserie",
      },
      reason: "other",
      otherReason: "Motif personnalisé",
    };

    await createArchivedConventionRequest.execute(input, connectedUser);

    expectToEqual(
      uow.archivedConventionRequestRepository.archivedConventionRequests[
        requestId
      ],
      {
        ...input,
        immersionAppellationCode: input.immersionAppellation.appellationCode,
        userId: connectedUser.id,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        status: "PENDING",
      },
    );
  });
});
