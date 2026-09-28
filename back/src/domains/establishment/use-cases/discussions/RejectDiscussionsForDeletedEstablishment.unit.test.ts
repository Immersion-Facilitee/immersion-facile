import {
  DiscussionBuilder,
  errors,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { makeCreateNewEvent } from "../../../core/events/ports/EventBus";
import { CustomTimeGateway } from "../../../core/time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../core/uuid-generator/adapters/UuidGeneratorImplementations";
import {
  establishmentDeletedRejectionReason,
  makeRejectDiscussionsForDeletedEstablishment,
  type RejectDiscussionsForDeletedEstablishment,
} from "./RejectDiscussionsForDeletedEstablishment";

describe("RejectDiscussionsForDeletedEstablishment", () => {
  const siret = "12345678901234";
  const otherSiret = "99999999999999";
  const now = new Date("2024-06-15T10:00:00.000Z");
  const triggeredBy = {
    kind: "connected-user" as const,
    userId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  };
  const expectedEventIds = ["event-id-1", "event-id-2"];

  const pendingDiscussion = new DiscussionBuilder()
    .withId("11111111-1111-4111-a111-111111111111")
    .withSiret(siret)
    .withStatus({ status: "PENDING" })
    .build();

  const anotherPendingDiscussion = new DiscussionBuilder()
    .withId("55555555-5555-4555-a555-555555555555")
    .withSiret(siret)
    .withStatus({ status: "PENDING" })
    .build();

  const rejectedDiscussion = new DiscussionBuilder()
    .withId("22222222-2222-4222-a222-222222222222")
    .withSiret(siret)
    .withStatus({ status: "REJECTED", rejectionKind: "UNABLE_TO_HELP" })
    .build();

  const acceptedDiscussion = new DiscussionBuilder()
    .withId("33333333-3333-4333-a333-333333333333")
    .withSiret(siret)
    .withStatus({ status: "ACCEPTED", candidateWarnedMethod: null })
    .build();

  const pendingDiscussionOnOtherEstablishment = new DiscussionBuilder()
    .withId("44444444-4444-4444-a444-444444444444")
    .withSiret(otherSiret)
    .withStatus({ status: "PENDING" })
    .build();

  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;
  let uuidGenerator: TestUuidGenerator;
  let rejectDiscussionsForDeletedEstablishment: RejectDiscussionsForDeletedEstablishment;

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway(now);
    uuidGenerator = new TestUuidGenerator();
    rejectDiscussionsForDeletedEstablishment =
      makeRejectDiscussionsForDeletedEstablishment({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          timeGateway,
          createNewEvent: makeCreateNewEvent({ timeGateway, uuidGenerator }),
        },
      });

    uow.deletedEstablishmentRepository.deletedEstablishments = [
      {
        siret,
        createdAt: new Date("2020-01-01"),
        deletedAt: now,
      },
    ];
  });

  describe("Wrong paths", () => {
    it("throws when the establishment is not deleted", async () => {
      uow.deletedEstablishmentRepository.deletedEstablishments = [];
      uow.discussionRepository.discussions = [pendingDiscussion];

      await expectPromiseToFailWithError(
        rejectDiscussionsForDeletedEstablishment.execute({
          siret,
          triggeredBy,
        }),
        errors.establishment.establishmentNotDeleted({ siret }),
      );

      expectToEqual(uow.discussionRepository.discussions, [pendingDiscussion]);
      expectToEqual(uow.outboxRepository.events, []);
    });
  });

  describe("Right paths", () => {
    it("does nothing when there are no pending discussions for the deleted establishment", async () => {
      uow.discussionRepository.discussions = [
        rejectedDiscussion,
        acceptedDiscussion,
        pendingDiscussionOnOtherEstablishment,
      ];

      await rejectDiscussionsForDeletedEstablishment.execute({
        siret,
        triggeredBy,
      });

      expectToEqual(uow.discussionRepository.discussions, [
        rejectedDiscussion,
        acceptedDiscussion,
        pendingDiscussionOnOtherEstablishment,
      ]);
      expectToEqual(uow.outboxRepository.events, []);
    });

    it("rejects pending discussions of the deleted establishment and emits events", async () => {
      uuidGenerator.setNextUuids(expectedEventIds);
      uow.discussionRepository.discussions = [
        pendingDiscussion,
        anotherPendingDiscussion,
        rejectedDiscussion,
        acceptedDiscussion,
        pendingDiscussionOnOtherEstablishment,
      ];

      await rejectDiscussionsForDeletedEstablishment.execute({
        siret,
        triggeredBy,
      });

      const rejectedPendingDiscussion = {
        ...pendingDiscussion,
        status: "REJECTED" as const,
        rejectionKind: "OTHER" as const,
        rejectionReason: establishmentDeletedRejectionReason,
        updatedAt: now.toISOString(),
      };
      const rejectedAnotherPendingDiscussion = {
        ...anotherPendingDiscussion,
        status: "REJECTED" as const,
        rejectionKind: "OTHER" as const,
        rejectionReason: establishmentDeletedRejectionReason,
        updatedAt: now.toISOString(),
      };

      expectToEqual(uow.discussionRepository.discussions, [
        rejectedPendingDiscussion,
        rejectedAnotherPendingDiscussion,
        rejectedDiscussion,
        acceptedDiscussion,
        pendingDiscussionOnOtherEstablishment,
      ]);
      expectArraysToMatch(uow.outboxRepository.events, [
        {
          topic: "DiscussionRejectedOnEstablishmentDeleted",
          payload: {
            discussion: rejectedPendingDiscussion,
            triggeredBy,
          },
        },
        {
          topic: "DiscussionRejectedOnEstablishmentDeleted",
          payload: {
            discussion: rejectedAnotherPendingDiscussion,
            triggeredBy,
          },
        },
      ]);
    });
  });
});
