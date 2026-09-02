import {
  ConnectedUserBuilder,
  DiscussionBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import { v4 as uuid } from "uuid";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { EstablishmentAggregateBuilder } from "../../helpers/EstablishmentBuilders";
import {
  type GetDiscussionById,
  makeGetDiscussionById,
} from "./GetDiscussionById";

describe("GetDiscussionById use case", () => {
  const establishmentAdmin = new ConnectedUserBuilder()
    .withId(uuid())
    .buildUser();
  const establishmentContact = new ConnectedUserBuilder()
    .withId(uuid())
    .buildUser();
  const pendingUser = new ConnectedUserBuilder().withId(uuid()).buildUser();
  const discussion = new DiscussionBuilder().withId(uuid()).build();
  const potentialBeneficiaryUser = new ConnectedUserBuilder()
    .withId(uuid())
    .withEmail(discussion.potentialBeneficiary.email)
    .buildUser();

  let getDiscussionById: GetDiscussionById;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    uow = createInMemoryUow();
    getDiscussionById = makeGetDiscussionById({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
    uow.userRepository.users = [
      establishmentAdmin,
      establishmentContact,
      pendingUser,
      potentialBeneficiaryUser,
    ];
    uow.discussionRepository.discussions = [discussion];
    uow.establishmentAggregateRepository.establishmentAggregates = [
      new EstablishmentAggregateBuilder()
        .withEstablishmentSiret(discussion.siret)
        .withUserRights([
          {
            role: "establishment-admin",
            status: "ACCEPTED",
            job: "",
            phone: "",
            userId: establishmentAdmin.id,
            shouldReceiveDiscussionNotifications: false,
            isMainContactByPhone: false,
          },
          {
            role: "establishment-contact",
            status: "ACCEPTED",
            userId: establishmentContact.id,
            shouldReceiveDiscussionNotifications: false,
          },
          {
            role: "establishment-contact",
            status: "PENDING",
            userId: pendingUser.id,
            shouldReceiveDiscussionNotifications: false,
          },
        ])
        .build(),
    ];
  });

  describe("Wrong paths", () => {
    describe("throws NotFound", () => {
      it("when user cannot be found", async () => {
        uow.userRepository.users = [];
        await expectPromiseToFailWithError(
          getDiscussionById.execute(discussion.id, {
            userId: establishmentAdmin.id,
          }),
          errors.user.notFound({ userId: establishmentAdmin.id }),
        );
      });

      it("when discussion cannot be found", async () => {
        const missingDiscussionId = uuid();

        await expectPromiseToFailWithError(
          getDiscussionById.execute(missingDiscussionId, {
            userId: establishmentAdmin.id,
          }),
          errors.discussion.notFound({ discussionId: missingDiscussionId }),
        );
      });

      it("when missing establishment and user is not potential beneficiary", async () => {
        uow.establishmentAggregateRepository.establishmentAggregates = [];

        await expectPromiseToFailWithError(
          getDiscussionById.execute(discussion.id, {
            userId: establishmentAdmin.id,
          }),
          errors.establishment.notFound({
            siret: discussion.siret,
          }),
        );
      });
    });

    it("throws accessForbidden when user has no accepted rights and is not potential beneficiary", async () => {
      uow.userRepository.users = [pendingUser];

      await expectPromiseToFailWithError(
        getDiscussionById.execute(discussion.id, {
          userId: pendingUser.id,
        }),
        errors.discussion.accessForbidden({
          discussionId: discussion.id,
          userId: pendingUser.id,
        }),
      );
    });
  });

  describe("Right paths", () => {
    it("returns discussion for potential beneficiary email match", async () => {
      expectToEqual(
        await getDiscussionById.execute(discussion.id, {
          userId: potentialBeneficiaryUser.id,
        }),
        new DiscussionBuilder(discussion).buildRead(),
      );
    });

    describe("Discussion with kinds and methods", () => {
      it.each([
        new DiscussionBuilder(discussion)
          .withDiscussionKind("IF")
          .withContactMode("EMAIL")
          .build(),
        new DiscussionBuilder(discussion)
          .withDiscussionKind("IF")
          .withContactMode("IN_PERSON")
          .build(),
        new DiscussionBuilder(discussion)
          .withDiscussionKind("IF")
          .withContactMode("PHONE")
          .build(),
        new DiscussionBuilder(discussion)
          .withDiscussionKind("1_ELEVE_1_STAGE")
          .withContactMode("EMAIL")
          .build(),
        new DiscussionBuilder(discussion)
          .withDiscussionKind("1_ELEVE_1_STAGE")
          .withContactMode("IN_PERSON")
          .build(),
        new DiscussionBuilder(discussion)
          .withDiscussionKind("1_ELEVE_1_STAGE")
          .withContactMode("PHONE")
          .build(),
      ])(
        "Gets discussion with kind $kind and contact mode $contactMode",
        async (discussion) => {
          uow.discussionRepository.discussions = [discussion];

          expectToEqual(
            await getDiscussionById.execute(discussion.id, {
              userId: establishmentAdmin.id,
            }),
            new DiscussionBuilder(discussion).buildRead(),
          );
        },
      );
    });

    describe("user has rights on discussion's establishment", () => {
      it("user has establishment admin right", async () => {
        expectToEqual(
          await getDiscussionById.execute(discussion.id, {
            userId: establishmentAdmin.id,
          }),
          new DiscussionBuilder(discussion).buildRead(),
        );
      });

      it("user has establishment contact right", async () => {
        expectToEqual(
          await getDiscussionById.execute(discussion.id, {
            userId: establishmentContact.id,
          }),
          new DiscussionBuilder(discussion).buildRead(),
        );
      });
    });
  });
});
