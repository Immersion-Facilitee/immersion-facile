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
import type { ArchivedConventionRequestToReviewListItem } from "../ports/ArchivedConventionRequestQueries";
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
  const adminConnectedUser = new ConnectedUserBuilder()
    .withIsAdmin(true)
    .build();

  const requestWithConventionId: ArchivedConventionRequestToReviewListItem = {
    id: "1",
    reason: "legalDispute",
    createdAt: new Date("2023-01-01").toISOString(),
    userId: user1.id,
    conventionSearchMethod: "withConventionId",
    conventionId: "11111111-1111-4111-8111-111111111111",
  };

  const requestWithConventionDetails: ArchivedConventionRequestToReviewListItem =
    {
      id: "2",
      reason: "other",
      otherReason: "Motif personnalisé pour la demande",
      createdAt: new Date("2024-01-01").toISOString(),
      userId: user2.id,
      conventionSearchMethod: "withConventionDetails",
      beneficiaryFirstName: "Marie",
      beneficiaryLastName: "Curie",
      siret: "12345678901234",
      immersionDate: "2024-01-15",
    };

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
  });

  describe("Happy path", () => {
    it("returns a request with conventionSearchMethod = withConventionId", async () => {
      uow.userRepository.users = [user1];
      archivedConventionRequestQueries.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
        [requestWithConventionId];

      expectToEqual(await useCase.execute(undefined, adminConnectedUser), [
        {
          id: requestWithConventionId.id,
          reason: requestWithConventionId.reason,
          createdAt: requestWithConventionId.createdAt,
          conventionSearchMethod: "withConventionId",
          conventionId: requestWithConventionId.conventionId,
          requester: {
            firstname: user1.firstName,
            lastname: user1.lastName,
            email: user1.email,
          },
        },
      ]);
    });

    it("returns a request with conventionSearchMethod = withConventionDetails and other reason", async () => {
      uow.userRepository.users = [user2];
      archivedConventionRequestQueries.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
        [requestWithConventionDetails];

      expectToEqual(await useCase.execute(undefined, adminConnectedUser), [
        {
          id: requestWithConventionDetails.id,
          reason: "other",
          otherReason: "Motif personnalisé pour la demande",
          createdAt: requestWithConventionDetails.createdAt,
          conventionSearchMethod: "withConventionDetails",
          beneficiaryFirstName:
            requestWithConventionDetails.beneficiaryFirstName,
          beneficiaryLastName: requestWithConventionDetails.beneficiaryLastName,
          siret: requestWithConventionDetails.siret,
          immersionDate: requestWithConventionDetails.immersionDate,
          requester: {
            firstname: user2.firstName,
            lastname: user2.lastName,
            email: user2.email,
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
      archivedConventionRequestQueries.getFirstOldestArchivedConventionRequestToReviewListNextResponse =
        [requestWithConventionId, requestWithConventionDetails];

      uow.userRepository.users = [user1];
      await expectPromiseToFailWithError(
        useCase.execute(undefined, adminConnectedUser),
        errors.users.notFound({ userIds: [user2.id] }),
      );
    });
  });
});
