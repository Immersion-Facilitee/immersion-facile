import {
  DiscussionBuilder,
  errors,
  expectPromiseToFailWithError,
  getFormattedFirstnameAndLastname,
} from "shared";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
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
  makeNotifyCandidateThatContactRequestHasBeenSent,
  type NotifyCandidateThatContactRequestHasBeenSent,
} from "./NotifyCandidateThatContactRequestHasBeenSent";

describe("NotifyCandidateThatContactRequestHasBeenSent", () => {
  let notifyCandidateThatContactRequestHasBeenSent: NotifyCandidateThatContactRequestHasBeenSent;
  let uow: InMemoryUnitOfWork;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;
  let config: AppConfig;
  beforeEach(() => {
    uow = createInMemoryUow();
    config = new AppConfigBuilder().build();
    const uowPerformer = new InMemoryUowPerformer(uow);
    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    const uuidGenerator = new UuidV4Generator();
    const timeGateway = new CustomTimeGateway();
    const saveNotificationAndRelatedEvent = makeSaveNotificationAndRelatedEvent(
      uuidGenerator,
      timeGateway,
    );
    notifyCandidateThatContactRequestHasBeenSent =
      makeNotifyCandidateThatContactRequestHasBeenSent({
        uowPerformer,
        deps: { saveNotificationAndRelatedEvent, config },
      });
  });

  it("throws when discussion is not found", async () => {
    const notFoundDiscussionId = new UuidV4Generator().new();
    await expectPromiseToFailWithError(
      notifyCandidateThatContactRequestHasBeenSent.execute({
        siret: "11112222333344",
        discussionId: notFoundDiscussionId,
      }),
      errors.discussion.notFound({ discussionId: notFoundDiscussionId }),
    );
  });

  it("sends an email to the beneficiary when contact mode is EMAIL", async () => {
    const discussion = new DiscussionBuilder().withContactMode("EMAIL").build();

    uow.discussionRepository.discussions = [discussion];

    await notifyCandidateThatContactRequestHasBeenSent.execute({
      siret: discussion.siret,
      discussionId: discussion.id,
    });
    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "CONTACT_BY_EMAIL_CANDIDATE_CONFIRMATION",
          recipients: [discussion.potentialBeneficiary.email],
          params: {
            businessName: discussion.businessName,
            beneficiaryFirstName: getFormattedFirstnameAndLastname({
              firstname: discussion.potentialBeneficiary.firstName,
            }),
            beneficiaryLastName: getFormattedFirstnameAndLastname({
              lastname: discussion.potentialBeneficiary.lastName,
            }),
            kind: discussion.kind,
            beneficiaryDashboardUrl:
              "http://localhost/mon-compte/tableau-de-bord-beneficiaire",
          },
        },
      ],
    });
  });

  it.each(["PHONE", "IN_PERSON"] as const)(
    "does not sends an email when contact mode is %s",
    async (contactMode) => {
      const discussion = new DiscussionBuilder()
        .withContactMode(contactMode)
        .build();

      uow.discussionRepository.discussions = [discussion];

      await notifyCandidateThatContactRequestHasBeenSent.execute({
        discussionId: discussion.id,
        siret: discussion.siret,
      });

      expectSavedNotificationsAndEvents({ emails: [] });
    },
  );
});
