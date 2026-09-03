import {
  type ConnectedUser,
  ConnectedUserBuilder,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
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
import type { ArchivedConventionRequestEntity } from "../entities/ArchivedConventionRequestEntity";
import {
  type HandleArchivedConventionRequest,
  makeHandleArchivedConventionRequest,
} from "./HandleArchivedConventionRequest";

describe("HandleArchivedConventionRequest", () => {
  let uow: InMemoryUnitOfWork;
  let handleArchivedConventionRequest: HandleArchivedConventionRequest;
  let createNewEvent: CreateNewEvent;
  let timeGateway: CustomTimeGateway;

  const adminConnectedUser: ConnectedUser = new ConnectedUserBuilder()
    .withIsAdmin(true)
    .build();
  const now = new Date("2024-06-01T12:00:00.000Z");
  const createdAt = new Date("2024-01-01T00:00:00.000Z");
  const requestId = "11111111-1111-4111-8111-111111111111";

  const pendingRequest: ArchivedConventionRequestEntity = {
    id: requestId,
    conventionSearchMethod: "withConventionId",
    conventionId: "22222222-2222-4222-8222-222222222222",
    reason: "legalDispute",
    userId: "33333333-3333-4333-8333-333333333333",
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    status: "PENDING",
  };

  beforeEach(() => {
    timeGateway = new CustomTimeGateway(now);
    const uuidGenerator = new TestUuidGenerator();

    uow = createInMemoryUow();
    createNewEvent = makeCreateNewEvent({ timeGateway, uuidGenerator });
    handleArchivedConventionRequest = makeHandleArchivedConventionRequest({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: { createNewEvent, timeGateway },
    });
    uow.archivedConventionRequestRepository.archivedConventionRequests = {
      [requestId]: pendingRequest,
    };
  });

  describe("Happy path", () => {
    it("marks a PENDING request as TREATED", async () => {
      await handleArchivedConventionRequest.execute(
        { archivedConventionRequestId: requestId, status: "TREATED" },
        adminConnectedUser,
      );

      expectToEqual(
        uow.archivedConventionRequestRepository.archivedConventionRequests[
          requestId
        ],
        {
          ...pendingRequest,
          status: "TREATED",
          updatedAt: now.toISOString(),
        },
      );

      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "ArchivedConventionRequestHandled",
          payload: {
            archivedConventionRequestId: requestId,
            status: "TREATED",
            triggeredBy: {
              kind: "connected-user",
              userId: adminConnectedUser.id,
            },
          },
        },
      ]);
    });

    it("marks a PENDING request as REJECTED", async () => {
      await handleArchivedConventionRequest.execute(
        { archivedConventionRequestId: requestId, status: "REJECTED" },
        adminConnectedUser,
      );

      expectToEqual(
        uow.archivedConventionRequestRepository.archivedConventionRequests[
          requestId
        ],
        {
          ...pendingRequest,
          status: "REJECTED",
          updatedAt: now.toISOString(),
        },
      );

      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "ArchivedConventionRequestHandled",
          payload: {
            archivedConventionRequestId: requestId,
            status: "REJECTED",
            triggeredBy: {
              kind: "connected-user",
              userId: adminConnectedUser.id,
            },
          },
        },
      ]);
    });
  });

  describe("Wrong path", () => {
    it("throws forbidden if user is not backoffice admin", async () => {
      const notAdminUser = new ConnectedUserBuilder()
        .withIsAdmin(false)
        .build();

      await expectPromiseToFailWithError(
        handleArchivedConventionRequest.execute(
          { archivedConventionRequestId: requestId, status: "TREATED" },
          notAdminUser,
        ),
        errors.user.forbidden({ userId: notAdminUser.id }),
      );

      expectToEqual(
        uow.archivedConventionRequestRepository.archivedConventionRequests[
          requestId
        ],
        pendingRequest,
      );
      expectToEqual(uow.outboxRepository.events, []);
    });

    it("throws notFound if archived convention request does not exist", async () => {
      const unknownRequestId = "99999999-9999-4999-8999-999999999999";

      await expectPromiseToFailWithError(
        handleArchivedConventionRequest.execute(
          { archivedConventionRequestId: unknownRequestId, status: "TREATED" },
          adminConnectedUser,
        ),
        errors.archivedConventionRequest.notFound({ id: unknownRequestId }),
      );

      expectToEqual(
        uow.archivedConventionRequestRepository.archivedConventionRequests[
          requestId
        ],
        pendingRequest,
      );
      expectToEqual(uow.outboxRepository.events, []);
    });

    it.each(["TREATED", "REJECTED"] as const)(
      "throws alreadyHandled if request is already %s",
      async (existingStatus) => {
        const alreadyHandledRequest: ArchivedConventionRequestEntity = {
          ...pendingRequest,
          status: existingStatus,
          updatedAt: createdAt.toISOString(),
        };

        uow.archivedConventionRequestRepository.archivedConventionRequests = {
          [requestId]: alreadyHandledRequest,
        };

        await expectPromiseToFailWithError(
          handleArchivedConventionRequest.execute(
            {
              archivedConventionRequestId: requestId,
              status: existingStatus === "TREATED" ? "REJECTED" : "TREATED",
            },
            adminConnectedUser,
          ),
          errors.archivedConventionRequest.alreadyHandled({ id: requestId }),
        );

        expectToEqual(
          uow.archivedConventionRequestRepository.archivedConventionRequests[
            requestId
          ],
          alreadyHandledRequest,
        );
        expectToEqual(uow.outboxRepository.events, []);
      },
    );
  });
});
