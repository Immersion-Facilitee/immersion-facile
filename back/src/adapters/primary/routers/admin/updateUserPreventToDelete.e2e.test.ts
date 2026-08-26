import {
  type AdminRoutes,
  adminRoutes,
  ConnectedUserBuilder,
  type ConnectedUserJwt,
  currentJwtVersions,
  errors,
  expectHttpResponseToEqual,
  expectToEqual,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { buildTestApp } from "../../../../utils/buildTestApp";

describe("updateUserPreventToDelete", () => {
  let adminBackofficeToken: ConnectedUserJwt;
  let nonAdminBackofficeToken: ConnectedUserJwt;
  let inMemoryUow: InMemoryUnitOfWork;
  let httpClient: HttpClient<AdminRoutes>;

  const connectedNonAdminBackofficeUser = new ConnectedUserBuilder()
    .withId("non-admin-backoffice-user")
    .withEmail("non-admin-backoffice@mail.com")
    .withProConnectInfos(null)
    .build();
  const connectedAdminBackofficeUser = new ConnectedUserBuilder()
    .withId("admin-backoffice-user")
    .withEmail("admin-backoffice@mail.com")
    .withProConnectInfos(null)
    .withIsAdmin(true)
    .build();
  const targetUser = new ConnectedUserBuilder()
    .withId("target-user")
    .withEmail("target@mail.com")
    .withProConnectInfos(null)
    .build();

  beforeEach(async () => {
    const testApp = await buildTestApp();
    ({ inMemoryUow } = testApp);
    httpClient = createSupertestSharedClient(adminRoutes, testApp.request);

    inMemoryUow.userRepository.users = [
      connectedAdminBackofficeUser,
      connectedNonAdminBackofficeUser,
      targetUser,
    ];

    nonAdminBackofficeToken = testApp.generateConnectedUserJwt({
      version: currentJwtVersions.connectedUser,
      userId: connectedNonAdminBackofficeUser.id,
    });

    adminBackofficeToken = testApp.generateConnectedUserJwt({
      userId: connectedAdminBackofficeUser.id,
      version: currentJwtVersions.connectedUser,
    });
  });

  describe("Wrong paths", () => {
    it("401 - returns 401 when missing token", async () => {
      const response = await httpClient.updateUserPreventToDelete({
        headers: { authorization: "" },
        urlParams: { userId: targetUser.id },
        body: { preventToDelete: true },
      });

      expectHttpResponseToEqual(response, {
        status: 401,
        body: {
          message: "Veuillez vous authentifier",
          status: 401,
        },
      });
    });

    it("403 - returns 403 when user is not admin", async () => {
      const response = await httpClient.updateUserPreventToDelete({
        headers: { authorization: nonAdminBackofficeToken },
        urlParams: { userId: targetUser.id },
        body: { preventToDelete: true },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          message: errors.user.forbidden({
            userId: connectedNonAdminBackofficeUser.id,
          }).message,
          status: 403,
        },
      });
    });

    it("404 - returns 404 when target user is not found", async () => {
      const unknownUserId = "unknown-user-id";
      const response = await httpClient.updateUserPreventToDelete({
        headers: { authorization: adminBackofficeToken },
        urlParams: { userId: unknownUserId },
        body: { preventToDelete: true },
      });

      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          message: errors.user.notFound({ userId: unknownUserId }).message,
          status: 404,
        },
      });
    });
  });

  describe("Right paths", () => {
    it("200 - sets preventToDelete to true", async () => {
      const response = await httpClient.updateUserPreventToDelete({
        headers: { authorization: adminBackofficeToken },
        urlParams: { userId: targetUser.id },
        body: { preventToDelete: true },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
      expectToEqual(
        inMemoryUow.userRepository.users.find(
          (user) => user.id === targetUser.id,
        )?.preventToDelete,
        true,
      );
    });

    it("200 - unsets preventToDelete", async () => {
      inMemoryUow.userRepository.users = [
        connectedAdminBackofficeUser,
        connectedNonAdminBackofficeUser,
        new ConnectedUserBuilder(targetUser).withPreventToDelete(true).build(),
      ];

      const response = await httpClient.updateUserPreventToDelete({
        headers: { authorization: adminBackofficeToken },
        urlParams: { userId: targetUser.id },
        body: { preventToDelete: false },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: "",
      });
      expectToEqual(
        inMemoryUow.userRepository.users.find(
          (user) => user.id === targetUser.id,
        )?.preventToDelete,
        undefined,
      );
    });
  });
});
