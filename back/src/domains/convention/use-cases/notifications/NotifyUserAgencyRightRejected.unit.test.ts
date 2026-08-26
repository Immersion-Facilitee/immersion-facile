import {
  AgencyDtoBuilder,
  defaultProConnectInfos,
  errors,
  expectPromiseToFailWithError,
  type User,
} from "shared";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { UuidV4Generator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyUserAgencyRightRejected,
  type NotifyUserAgencyRightRejected,
} from "./NotifyUserAgencyRightRejected";

describe("NotifyUserAgencyRightRejected", () => {
  const agency = new AgencyDtoBuilder().withId("agency-1").build();

  const user: User = {
    id: "john-123",
    email: "john@mail.com",
    firstName: "John",
    lastName: "Lennon",
    proConnect: defaultProConnectInfos,
    createdAt: new Date().toISOString(),
    preventToDelete: false,
  };

  let uow: InMemoryUnitOfWork;
  let notifyUserAgencyRightRejected: NotifyUserAgencyRightRejected;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  beforeEach(() => {
    uow = createInMemoryUow();
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    notifyUserAgencyRightRejected = makeNotifyUserAgencyRightRejected({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          new UuidV4Generator(),
          new CustomTimeGateway(),
        ),
      },
    });
  });

  it("Throw when no agency were found", async () => {
    await expectPromiseToFailWithError(
      notifyUserAgencyRightRejected.execute({
        agencyId: agency.id,
        justification: "osef",
        userId: user.id,
      }),
      errors.agency.notFound({ agencyId: agency.id }),
    );
  });

  it("Throw when no icUser were found", async () => {
    uow.agencyRepository.agencies = [toAgencyWithRights(agency)];

    await expectPromiseToFailWithError(
      notifyUserAgencyRightRejected.execute({
        agencyId: agency.id,
        justification: "osef",
        userId: user.id,
      }),
      errors.user.notFound({
        userId: user.id,
      }),
    );
  });

  it("Send an email to icUser to notify that registration to agency was rejected", async () => {
    uow.agencyRepository.agencies = [toAgencyWithRights(agency)];
    uow.userRepository.users = [user];

    await notifyUserAgencyRightRejected.execute({
      agencyId: agency.id,
      justification: "osef",
      userId: user.id,
    });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "IC_USER_REGISTRATION_TO_AGENCY_REJECTED",
          params: { agencyName: agency.name, justification: "osef" },
          recipients: [user.email],
        },
      ],
    });
  });
});
