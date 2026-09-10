import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type ConventionSummaryNotifications,
  makeConventionSummaryNotifications,
} from "./ConventionSummaryNotifications";

describe("ConventionSummaryNotifications", () => {
  let useCase: ConventionSummaryNotifications;
  let uow: InMemoryUnitOfWork;
  let uuidGenerator: TestUuidGenerator;
  let timeGateway: CustomTimeGateway;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    uow = createInMemoryUow();
    uuidGenerator = new TestUuidGenerator();
    timeGateway = new CustomTimeGateway();
    useCase = makeConventionSummaryNotifications({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        saveNotificationsBatchAndRelatedEvent:
          makeSaveNotificationsBatchAndRelatedEvent(uuidGenerator, timeGateway),
        timeGateway,
      },
    });
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
  });

  describe("right path", () => {
    it("sends notification to contactEmail and validated users except to-review", async () => {
      await useCase.execute();

      expectSavedNotificationsAndEvents({ emails: [] });
    });
  });
});
