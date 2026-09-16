import {
  ConnectedUserBuilder,
  DiscussionBuilder,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { makeSaveNotificationsBatchAndRelatedEvent } from "../../../core/notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import { EstablishmentAggregateBuilder } from "../../helpers/EstablishmentBuilders";
import {
  makeNotifyBeneficiaryToFollowUpContactRequest,
  type NotifyBeneficiaryToFollowUpContactRequest,
} from "./NotifyBeneficiaryToFollowUpContactRequest";

describe("NotifyBeneficiaryToFollowUpContactRequest", () => {
  const discussion = new DiscussionBuilder()
    .withId("11111111-1111-4111-9111-111111111111")
    .withStatus({
      status: "PENDING",
    })
    .build();

  const contactUser = new ConnectedUserBuilder()
    .withId("contact-user-id")
    .withEmail("contact@establishment.com")
    .withFirstName("John")
    .withLastName("Doe")
    .buildUser();

  const expectedNotificationId = "notification-id-1";
  const expectedEventId = "event-id-1";

  let uow: InMemoryUnitOfWork;
  let notifyBeneficiaryToFollowUpContactRequest: NotifyBeneficiaryToFollowUpContactRequest;

  beforeEach(() => {
    const uuidGenerator = new TestUuidGenerator();

    uow = createInMemoryUow();
    notifyBeneficiaryToFollowUpContactRequest =
      makeNotifyBeneficiaryToFollowUpContactRequest({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          saveNotificationsBatchAndRelatedEvent:
            makeSaveNotificationsBatchAndRelatedEvent(
              uuidGenerator,
              new CustomTimeGateway(),
            ),
        },
      });

    uuidGenerator.setNextUuids([expectedNotificationId, expectedEventId]);
    uow.discussionRepository.discussions = [discussion];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(discussion.siret)
        .withUserRights([
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: contactUser.id,
            job: "Manager",
            phone: "+33123456789",
            isMainContactByPhone: true,
            shouldReceiveDiscussionNotifications: false,
          },
        ])
        .build(),
    ];
    uow.userRepository.users = [contactUser];
  });

  describe("Wrong paths", () => {
    it("should throw an error if discussion is not found", async () => {
      uow.discussionRepository.discussions = [];

      await expectPromiseToFailWithError(
        notifyBeneficiaryToFollowUpContactRequest.execute({
          discussionId: discussion.id,
        }),
        errors.discussion.notFound({ discussionId: discussion.id }),
      );
    });

    it("should throw an error if discussion status is not PENDING", async () => {
      const acceptedDiscussion = new DiscussionBuilder(discussion)
        .withStatus({
          status: "ACCEPTED",
          candidateWarnedMethod: "email",
        })
        .build();

      uow.discussionRepository.discussions = [acceptedDiscussion];

      await expectPromiseToFailWithError(
        notifyBeneficiaryToFollowUpContactRequest.execute({
          discussionId: acceptedDiscussion.id,
        }),
        errors.discussion.badStatus({
          discussionId: acceptedDiscussion.id,
          expectedStatus: "PENDING",
        }),
      );
    });

    it("should throw an error if establishment is not found", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [];

      await expectPromiseToFailWithError(
        notifyBeneficiaryToFollowUpContactRequest.execute({
          discussionId: discussion.id,
        }),
        errors.establishment.notFound({ siret: discussion.siret }),
      );
    });

    it("should throw an error if no contact user with isMainContactByPhone is found", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        new EstablishmentAggregateBuilder()
          .withEstablishmentSiret(discussion.siret)
          .withUserRights([
            {
              role: "establishment-contact",
              status: "ACCEPTED",
              userId: contactUser.id,
              job: "Manager",
              phone: "+33123456789",
              isMainContactByPhone: false,
              shouldReceiveDiscussionNotifications: false,
            },
          ])
          .build(),
      ];

      await expectPromiseToFailWithError(
        notifyBeneficiaryToFollowUpContactRequest.execute({
          discussionId: discussion.id,
        }),
        errors.establishment.contactUserNotFound({
          siret: discussion.siret,
        }),
      );
    });

    it("should throw an error if contact user is not found in user repository", async () => {
      uow.userRepository.users = [];

      await expectPromiseToFailWithError(
        notifyBeneficiaryToFollowUpContactRequest.execute({
          discussionId: discussion.id,
        }),
        errors.user.notFound({ userId: contactUser.id }),
      );
    });

    it("should throw an error if contact user has no phone number", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        new EstablishmentAggregateBuilder()
          .withEstablishmentSiret(discussion.siret)
          .withUserRights([
            {
              role: "establishment-contact",
              status: "ACCEPTED",
              userId: contactUser.id,
              phone: undefined,
              isMainContactByPhone: true,
              shouldReceiveDiscussionNotifications: false,
            },
          ])
          .build(),
      ];
      await expectPromiseToFailWithError(
        notifyBeneficiaryToFollowUpContactRequest.execute({
          discussionId: discussion.id,
        }),
        errors.user.noContactPhone({ userId: contactUser.id }),
      );
    });
  });

  describe("Right paths", () => {
    it("should send notification email to beneficiary with contact details when all validations pass", async () => {
      await notifyBeneficiaryToFollowUpContactRequest.execute({
        discussionId: discussion.id,
      });

      expectToEqual(uow.notificationRepository.notifications, [
        {
          createdAt: "2021-09-01T10:10:00.000Z",
          followedIds: {
            establishmentSiret: discussion.siret,
          },
          id: expectedNotificationId,
          kind: "email",
          templatedContent: {
            kind: "DISCUSSION_BENEFICIARY_FOLLOW_UP",
            recipients: [discussion.potentialBeneficiary.email],
            params: {
              beneficiaryFirstName: discussion.potentialBeneficiary.firstName,
              beneficiaryLastName: discussion.potentialBeneficiary.lastName,
              businessName: discussion.businessName,
              contactFirstName: contactUser.firstName,
              contactLastName: contactUser.lastName,
              contactJob: "Manager",
              contactPhone: "+33123456789",
            },
          },
        },
      ]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "NotificationAdded",
          payload: { id: expectedNotificationId, kind: "email" },
          priority: 5,
        },
      ]);
    });
  });
});
