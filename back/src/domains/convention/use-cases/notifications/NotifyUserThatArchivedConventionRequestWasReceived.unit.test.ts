import {
  type ConnectedUser,
  ConnectedUserBuilder,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyUserThatArchivedConventionRequestWasReceived,
  type NotifyUserThatArchivedConventionRequestWasReceived,
} from "./NotifyUserThatArchivedConventionRequestWasReceived";

describe("NotifyUserThatArchivedConventionRequestWasReceived", () => {
  let uow: InMemoryUnitOfWork;
  let notifyUserThatArchivedConventionRequestWasReceived: NotifyUserThatArchivedConventionRequestWasReceived;

  const requester: ConnectedUser = new ConnectedUserBuilder()
    .withId("requester-id")
    .withEmail("requester@example.com")
    .build();

  const archivedConventionRequestId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    uow = createInMemoryUow();
    const uuidGenerator = new TestUuidGenerator([
      "notification-id",
      "notification-event-id",
    ]);
    const timeGateway = new CustomTimeGateway(
      new Date("2024-06-01T12:00:00.000Z"),
    );

    notifyUserThatArchivedConventionRequestWasReceived =
      makeNotifyUserThatArchivedConventionRequestWasReceived({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
            uuidGenerator,
            timeGateway,
          ),
        },
      });
  });

  it("saves an email notification for the requester", async () => {
    uow.userRepository.users = [requester];
    await uow.archivedConventionRequestRepository.save({
      id: archivedConventionRequestId,
      userId: requester.id,
      status: "PENDING",
      createdAt: "2024-06-01T12:00:00.000Z",
      updatedAt: "2024-06-01T12:00:00.000Z",
      conventionSearchMethod: "withConventionId",
      conventionId: "22222222-2222-4222-8222-222222222222",
      reason: "legalDispute",
    });

    await notifyUserThatArchivedConventionRequestWasReceived.execute({
      archivedConventionRequestId,
      triggeredBy: {
        kind: "connected-user",
        userId: requester.id,
      },
    });

    expectToEqual(uow.notificationRepository.notifications, [
      {
        id: "notification-id",
        kind: "email",
        createdAt: "2024-06-01T12:00:00.000Z",
        templatedContent: {
          kind: "ARCHIVED_CONVENTION_REQUEST_RECEIVED",
          recipients: [requester.email],
          params: {
            archivedConventionRequestId,
          },
        },
        followedIds: {
          userId: requester.id,
        },
      },
    ]);

    expectArraysToMatch(uow.outboxRepository.events, [
      {
        topic: "NotificationAdded",
        payload: {
          id: "notification-id",
          kind: "email",
        },
      },
    ]);
  });

  it("throws when archived convention request is not found", async () => {
    await expectPromiseToFailWithError(
      notifyUserThatArchivedConventionRequestWasReceived.execute({
        archivedConventionRequestId,
        triggeredBy: {
          kind: "connected-user",
          userId: requester.id,
        },
      }),
      errors.archivedConventionRequest.notFound({
        id: archivedConventionRequestId,
      }),
    );

    expectToEqual(uow.notificationRepository.notifications, []);
    expectToEqual(uow.outboxRepository.events, []);
  });

  it("throws when requester is not found", async () => {
    await uow.archivedConventionRequestRepository.save({
      id: archivedConventionRequestId,
      userId: requester.id,
      status: "PENDING",
      createdAt: "2024-06-01T12:00:00.000Z",
      updatedAt: "2024-06-01T12:00:00.000Z",
      conventionSearchMethod: "withConventionId",
      conventionId: "22222222-2222-4222-8222-222222222222",
      reason: "legalDispute",
    });

    await expectPromiseToFailWithError(
      notifyUserThatArchivedConventionRequestWasReceived.execute({
        archivedConventionRequestId,
        triggeredBy: {
          kind: "connected-user",
          userId: requester.id,
        },
      }),
      errors.user.notFound({
        userId: requester.id,
      }),
    );

    expectToEqual(uow.notificationRepository.notifications, []);
    expectToEqual(uow.outboxRepository.events, []);
  });
});
