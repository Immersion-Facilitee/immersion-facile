import {
  DiscussionBuilder,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { makeSaveNotificationAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  makeNotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted,
  type NotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted,
} from "./NotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted";
import { establishmentDeletedRejectionReason } from "./RejectDiscussionsForDeletedEstablishment";

describe("NotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted", () => {
  const discussion = new DiscussionBuilder()
    .withId("11111111-1111-4111-a111-111111111111")
    .withStatus({
      status: "REJECTED",
      rejectionKind: "OTHER",
      rejectionReason: establishmentDeletedRejectionReason,
    })
    .build();

  const expectedNotificationId = "notification-id-1";
  const expectedEventId = "event-id-1";

  let uow: InMemoryUnitOfWork;
  let notifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted: NotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted;

  beforeEach(() => {
    const uuidGenerator = new TestUuidGenerator();
    uow = createInMemoryUow();
    notifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted =
      makeNotifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
            uuidGenerator,
            new CustomTimeGateway(),
          ),
          config: new AppConfigBuilder().build(),
        },
      });

    uuidGenerator.setNextUuids([expectedNotificationId, expectedEventId]);
    uow.discussionRepository.discussions = [discussion];
  });

  describe("Wrong paths", () => {
    it("throws when discussion is not found", async () => {
      uow.discussionRepository.discussions = [];

      await expectPromiseToFailWithError(
        notifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted.execute(
          { discussionId: discussion.id },
        ),
        errors.discussion.notFound({ discussionId: discussion.id }),
      );
    });

    it("throws when discussion is not rejected for establishment deletion", async () => {
      const pendingDiscussion = new DiscussionBuilder(discussion)
        .withStatus({ status: "PENDING" })
        .build();
      uow.discussionRepository.discussions = [pendingDiscussion];

      await expectPromiseToFailWithError(
        notifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted.execute(
          { discussionId: pendingDiscussion.id },
        ),
        errors.discussion.badStatus({
          discussionId: pendingDiscussion.id,
          expectedStatus: "REJECTED",
        }),
      );
    });
  });

  describe("Right paths", () => {
    it("notifies the beneficiary that the discussion was closed because the establishment unsubscribed", async () => {
      await notifyBeneficiaryThatDiscussionWasRejectedOnEstablishmentDeleted.execute(
        { discussionId: discussion.id },
      );

      expectToEqual(uow.notificationRepository.notifications, [
        {
          createdAt: "2021-09-01T10:10:00.000Z",
          followedIds: {
            establishmentSiret: discussion.siret,
          },
          id: expectedNotificationId,
          kind: "email",
          templatedContent: {
            kind: "ESTABLISHMENT_DELETED_NOTIFICATION_TO_BENEFICIARY",
            recipients: [discussion.potentialBeneficiary.email],
            params: {
              beneficiaryFirstName: discussion.potentialBeneficiary.firstName,
              beneficiaryLastName: discussion.potentialBeneficiary.lastName,
              businessName: discussion.businessName,
              discussionCreatedAt: discussion.createdAt,
              searchPageUrl: "http://localhost/recherche",
            },
          },
        },
      ]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "NotificationAdded",
          payload: { id: expectedNotificationId, kind: "email" },
        },
      ]);
    });
  });
});
