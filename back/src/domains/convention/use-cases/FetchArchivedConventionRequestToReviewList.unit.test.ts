import {
  ConnectedUserBuilder,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
} from "shared";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import { InMemoryArchivedConventionRequestQueries } from "../adapters/archived-convention-request/InMemoryArchivedConventionRequestQueries";
import {
  type FetchArchivedConventionRequestToReviewList,
  makeFetchArchivedConventionRequestToReviewList,
} from "./FetchArchivedConventionRequestToReviewList";

describe("FetchArchivedConventionRequestToReviewList", () => {
  const user1 = new ConnectedUserBuilder()
    .withId("1")
    .withFirstName("Jason")
    .withLastName("Burnes")
    .withEmail("jburnes@mail.com")
    .buildUser();
  const user2 = new ConnectedUserBuilder()
    .withId("2")
    .withFirstName("Jean")
    .withLastName("Foutre")
    .withEmail("jf@mail.com")
    .buildUser();
  const user3 = new ConnectedUserBuilder()
    .withId("3")
    .withFirstName("Billy")
    .withLastName("Idol")
    .withEmail("elfamoso@mail.com")
    .buildUser();
  const user4 = new ConnectedUserBuilder()
    .withId("4")
    .withFirstName("Martin")
    .withLastName("Pêcheur")
    .withEmail("inspecteur@urssaf.fr")
    .buildUser();
  const adminConnectedUser = new ConnectedUserBuilder()
    .withIsAdmin(true)
    .build();

  let useCase: FetchArchivedConventionRequestToReviewList;
  let uow: InMemoryUnitOfWork;
  let archivedConventionRequestQueries: InMemoryArchivedConventionRequestQueries;

  beforeEach(() => {
    uow = createInMemoryUow();
    archivedConventionRequestQueries =
      new InMemoryArchivedConventionRequestQueries();
    useCase = makeFetchArchivedConventionRequestToReviewList({
      deps: { archivedConventionRequestQueries },
      uowPerformer: new InMemoryUowPerformer(uow),
    });

    archivedConventionRequestQueries.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
      [
        {
          id: "1",
          reason: "legalDispute",
          createdAt: new Date("2023-01-01").toISOString(),
          userId: user1.id,
        },
        {
          id: "2",
          reason: "other",
          createdAt: new Date("2024-01-01").toISOString(),
          userId: user2.id,
        },
        {
          id: "3",
          reason: "rpeAdvisorAccessToBeneficiaryHistory",
          createdAt: new Date("2025-01-01").toISOString(),
          userId: user3.id,
        },
        {
          id: "4",
          reason: "urssafOrInspectionControl",
          createdAt: new Date("2026-01-01").toISOString(),
          userId: user4.id,
        },
      ];
  });

  describe("Happy path", () => {
    it("Should return archived convention requests to review when user is backoffice admin", async () => {
      uow.userRepository.users = [user1, user2, user3, user4];

      expectToEqual(await useCase.execute(undefined, adminConnectedUser), [
        {
          id: "1",
          reason: "legalDispute",
          createdAt: new Date("2023-01-01").toISOString(),
          requester: {
            firstname: user1.firstName,
            lastname: user1.lastName,
            email: user1.email,
          },
        },
        {
          id: "2",
          reason: "other",
          createdAt: new Date("2024-01-01").toISOString(),
          requester: {
            firstname: user2.firstName,
            lastname: user2.lastName,
            email: user2.email,
          },
        },
        {
          id: "3",
          reason: "rpeAdvisorAccessToBeneficiaryHistory",
          createdAt: new Date("2025-01-01").toISOString(),
          requester: {
            firstname: user3.firstName,
            lastname: user3.lastName,
            email: user3.email,
          },
        },
        {
          id: "4",
          reason: "urssafOrInspectionControl",
          createdAt: new Date("2026-01-01").toISOString(),
          requester: {
            firstname: user4.firstName,
            lastname: user4.lastName,
            email: user4.email,
          },
        },
      ]);
    });
  });

  describe("Wrong path", () => {
    it("Should throw forbidden if user is not backoffice admin", async () => {
      const notAdminUser = new ConnectedUserBuilder()
        .withIsAdmin(false)
        .build();

      await expectPromiseToFailWithError(
        useCase.execute(undefined, notAdminUser),
        errors.user.forbidden({ userId: notAdminUser.id }),
      );
    });

    it("Should throw not found if requesters are missing on user repo", async () => {
      uow.userRepository.users = [user1, user2];
      await expectPromiseToFailWithError(
        useCase.execute(undefined, adminConnectedUser),
        errors.users.notFound({ userIds: [user3.id, user4.id] }),
      );
    });
  });
});
