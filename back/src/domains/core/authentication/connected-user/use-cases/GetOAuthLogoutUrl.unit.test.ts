import {
  ConnectedUserBuilder,
  defaultProConnectInfos,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  queryParamsAsString,
} from "shared";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import {
  fakeProConnectLogoutUri,
  fakeProviderConfig,
  InMemoryProConnectOAuthGateway,
} from "../adapters/oauth-gateway/InMemoryOAuthGateway";
import type { OngoingOAuth } from "../entities/OngoingOAuth";
import {
  type GetOAuthLogoutUrl,
  makeGetOAuthLogoutUrl,
} from "./GetOAuthLogoutUrl";

describe("GetOAuthLogoutUrl", () => {
  const connectedUserBuilder = new ConnectedUserBuilder()
    .withId("my-user-id")
    .withEmail("user@mail.com")
    .withFirstName("User")
    .withLastName("App")
    .withCreatedAt(new Date())
    .withProConnectInfos(defaultProConnectInfos);

  const user = connectedUserBuilder.buildUser();
  const connectedUser = connectedUserBuilder.build();

  describe("With OAuthGateway provider 'proConnect'", () => {
    let uow: InMemoryUnitOfWork;
    let getOAuthLogoutUrl: GetOAuthLogoutUrl;

    beforeEach(() => {
      uow = createInMemoryUow();
      uow.userRepository.users = [user];
      getOAuthLogoutUrl = makeGetOAuthLogoutUrl({
        uowPerformer: new InMemoryUowPerformer(uow),
        deps: {
          proConnectOAuthGateway: new InMemoryProConnectOAuthGateway(
            fakeProviderConfig,
          ),
        },
      });
    });

    describe("when provider is 'proConnect'", () => {
      it("throws when it does not find the ongoingOAuth", async () => {
        uow.ongoingOAuthRepository.ongoingOAuths = [];
        await expectPromiseToFailWithError(
          getOAuthLogoutUrl.execute(undefined, connectedUser),
          errors.auth.missingOAuth({}),
        );
      });

      it("returns the oAuth logout url from %s", async () => {
        const idToken = "fake-id-token";

        const ongoingOAuth: OngoingOAuth = {
          fromUri: "/uri",
          state: "some-state",
          nonce: "some-nonce",
          provider: "proConnect",
          userId: user.id,
          externalId: user.proConnect?.externalId,
          accessToken: "fake-access-token",
          usedAt: null,
          idToken,
        };
        uow.ongoingOAuthRepository.ongoingOAuths = [ongoingOAuth];
        expectToEqual(
          await getOAuthLogoutUrl.execute(undefined, connectedUser),
          `${
            fakeProviderConfig.providerBaseUri
          }${fakeProConnectLogoutUri}?${queryParamsAsString({
            postLogoutRedirectUrl:
              fakeProviderConfig.immersionRedirectUri.afterLogout,
            idToken,
            state: ongoingOAuth.state,
          })}`,
        );
      });
    });

    describe("wrong paths", () => {
      it("fails on FtConnect provider", async () => {
        const ongoingOAuth: OngoingOAuth = {
          fromUri: "/uri",
          state: "some-state",
          nonce: "some-nonce",
          provider: "ftConnect",
          accessToken: "fake-access-token",
          userId: user.id,
          usedAt: null,
          idToken: "token",
        };
        uow.ongoingOAuthRepository.ongoingOAuths = [ongoingOAuth];

        await expectPromiseToFailWithError(
          getOAuthLogoutUrl.execute(undefined, connectedUser),
          errors.auth.accessTokenErrorType({
            actualType: ongoingOAuth.provider,
            expectedType: "proConnect",
          }),
        );
      });

      it("fails on email provider", async () => {
        const ongoingOAuth: OngoingOAuth = {
          fromUri: "/uri",
          state: "some-state",
          nonce: "some-nonce",
          provider: "email",
          userId: user.id,
          usedAt: null,
          email: "mail@mail.com",
        };
        uow.ongoingOAuthRepository.ongoingOAuths = [ongoingOAuth];

        await expectPromiseToFailWithError(
          getOAuthLogoutUrl.execute(undefined, connectedUser),
          errors.auth.accessTokenErrorType({
            actualType: ongoingOAuth.provider,
            expectedType: "proConnect",
          }),
        );
      });

      it("fails on missing idToken provider", async () => {
        const ongoingOAuth: OngoingOAuth = {
          fromUri: "/uri",
          state: "some-state",
          nonce: "some-nonce",
          provider: "proConnect",
          accessToken: "fake-access-token",
          userId: user.id,
          usedAt: null,
          idToken: null,
        };
        uow.ongoingOAuthRepository.ongoingOAuths = [ongoingOAuth];

        await expectPromiseToFailWithError(
          getOAuthLogoutUrl.execute(undefined, connectedUser),
          errors.auth.missingIdToken(ongoingOAuth.state),
        );
      });
    });
  });
});
