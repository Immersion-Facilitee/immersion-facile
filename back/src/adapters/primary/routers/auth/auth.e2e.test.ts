import { keys } from "ramda";
import {
  AgencyDtoBuilder,
  type AuthRoutes,
  allowedLoginSources,
  authExpiredMessage,
  authRoutes,
  ConventionDtoBuilder,
  type ConventionRole,
  currentJwtVersions,
  decodeJwtWithoutSignatureCheck,
  decodeURIWithParams,
  defaultProConnectInfos,
  displayRouteName,
  type Email,
  errors,
  expectEmailOfType,
  expectHttpResponseToEqual,
  expectToEqual,
  FTConnectError,
  frontRoutes,
  ManagedFTConnectError,
  makeRouteAbsoluteUrl,
  noAgencyDashboards,
  noEstablishmentDashboard,
  queryParamsAsString,
  type Role,
  type TechnicalRoutes,
  technicalRoutes,
  toAgencyDtoForAgencyUsersAndAdmins,
  type User,
  UserBuilder,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { SuperTest, Test } from "supertest";
import { v4 as uuid } from "uuid";
import type { AppConfig } from "../../../../config/bootstrap/appConfig";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import {
  fakeProConnectLogoutUri,
  fakeProConnectSiret,
  fakeProviderConfig,
} from "../../../../domains/core/authentication/connected-user/adapters/oauth-gateway/InMemoryOAuthGateway";
import type { BasicEventCrawler } from "../../../../domains/core/events/adapters/EventCrawlerImplementations";
import {
  type GenerateConnectedUserJwt,
  type GenerateConventionJwt,
  makeGenerateJwtES256,
  makeVerifyJwtES256,
} from "../../../../domains/core/jwt";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import type { UuidGenerator } from "../../../../domains/core/uuid-generator/ports/UuidGenerator";
import { AppConfigBuilder } from "../../../../utils/AppConfigBuilder";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../../utils/buildTestApp";
import { shortLinkRedirectToLinkWithValidation } from "../../../../utils/e2eTestHelpers";
import {
  createConnectedUserJwtPayload,
  createConventionMagicLinkPayload,
} from "../../../../utils/jwt";
import { processEventsForEmailToBeSent } from "../../../../utils/processEventsForEmailToBeSent";

describe("auth router", () => {
  const immersionDomain = "immersion.fr";
  const now = new Date();

  let authRoutesClient: HttpClient<AuthRoutes>;
  let technicalRoutesClient: HttpClient<TechnicalRoutes>;
  let uuidGenerator: UuidGenerator;
  let gateways: InMemoryGateways;
  let eventCrawler: BasicEventCrawler;
  let inMemoryUow: InMemoryUnitOfWork;
  let appConfig: AppConfig;
  let generateConnectedUserJwt: GenerateConnectedUserJwt;
  let generateConventionJwt: GenerateConventionJwt;

  beforeEach(async () => {
    let request: SuperTest<Test>;

    ({
      uuidGenerator,
      gateways,
      request,
      eventCrawler,
      inMemoryUow,
      appConfig,
      generateConnectedUserJwt,
      generateConventionJwt,
    } = await buildTestApp(
      new AppConfigBuilder({
        PRO_CONNECT_GATEWAY: "IN_MEMORY",
        PRO_CONNECT_CLIENT_SECRET: fakeProviderConfig.clientSecret,
        PRO_CONNECT_CLIENT_ID: fakeProviderConfig.clientId,
        PRO_CONNECT_BASE_URI: fakeProviderConfig.providerBaseUri,
        DOMAIN: immersionDomain,
      }).build(),
    ));
    authRoutesClient = createSupertestSharedClient(authRoutes, request);
    technicalRoutesClient = createSupertestSharedClient(
      technicalRoutes,
      request,
    );
    gateways.timeGateway.setNextDate(now);
  });

  describe("user connexion flow", () => {
    const state = "my-state";
    const nonce = "nounce"; // matches the one in payload;

    const authCode = "pro-connect-auth-code";
    const proConnectToken = "pro-connect-token";
    const idToken = "pro-connect-id-token";
    const sub = "osef";

    describe("Right path with Proconnect", () => {
      describe("handle all allowed user connection pages", () => {
        it.each(keys(allowedLoginSources))(`${displayRouteName(
          authRoutes.initiateLoginByOAuth,
        )} 302 > [ProConnect]/login - 302 > ${displayRouteName(
          authRoutes.afterEmailOrProConnectOAuthLogin,
        )} 302 > page %s with required connected user params`, async (source) => {
          const generatedUserId = "my-user-id";
          const uuids = [nonce, state, generatedUserId];
          uuidGenerator.new = () => uuids.shift() ?? "no-uuid-provided";

          const redirectUri = allowedLoginSources[source]().href;

          expectHttpResponseToEqual(
            await authRoutesClient.initiateLoginByOAuth({
              queryParams: {
                provider: "proConnect",
                redirectUri,
              },
            }),
            {
              body: {},
              status: 302,
              headers: {
                location: encodeURI(
                  `${
                    appConfig.proConnectConfig.providerBaseUri
                  }/login?${queryParamsAsString({
                    nonce,
                    state,
                  })}`,
                ),
              },
            },
          );

          gateways.proConnectOAuthGateway.setAccessTokenResponse({
            type: "proConnect",
            accessToken: proConnectToken,
            idToken,
            expire: 1,
            payload: {
              email: "osef@gmail",
              firstName: "osef",
              lastName: "jean",
              nonce,
              sub,
              siret: fakeProConnectSiret,
            },
          });

          const response =
            await authRoutesClient.afterEmailOrProConnectOAuthLogin({
              queryParams: {
                code: authCode,
                state,
              },
            });

          if (response.status !== 302)
            throw errors.generic.testError("Response must be 302");
          const locationHeader = response.headers.location as string;
          const locationPrefix = `${appConfig.immersionFacileBaseUrl}${allowedLoginSources[source]({ token: "" }).href}`;

          expect(locationHeader).toContain(locationPrefix);
          const { params } = decodeURIWithParams(locationHeader);
          const { userId } = decodeJwtWithoutSignatureCheck<{
            userId: string;
          }>(params?.token ?? "");
          expect(userId).toBe(generatedUserId);
          expectToEqual(inMemoryUow.ongoingOAuthRepository.ongoingOAuths, [
            {
              provider: "proConnect",
              userId: generatedUserId,
              nonce,
              state,
              usedAt: gateways.timeGateway.now(),
              externalId: "osef",
              accessToken: proConnectToken,
              idToken,
              fromUri: redirectUri,
            },
          ]);
        });
      });

      it("throws an error if the redirect uri is not allowed", async () => {
        const response = await authRoutesClient.initiateLoginByOAuth({
          queryParams: {
            provider: "proConnect",
            redirectUri: "@example.com",
          },
        });

        expectHttpResponseToEqual(response, {
          body: {
            status: 400,
            issues: ["redirectUri : redirectUri is not allowed"],
            message:
              "Shared-route schema 'queryParamsSchema' was not respected in adapter 'express'.\nRoute: GET /login/oauth",
          },
          status: 400,
        });
      });

      it("should link the agency if a code safir matches an agency with ProConnect", async () => {
        const generatedUserId = "my-user-id";
        const uuids = [nonce, state, generatedUserId];
        uuidGenerator.new = () => uuids.shift() ?? "no-uuid-provided";

        expectHttpResponseToEqual(
          await authRoutesClient.initiateLoginByOAuth({
            queryParams: {
              provider: "proConnect",
              redirectUri: frontRoutes.agencyDashboardAgencyDetails({
                agencyId: "agencyId",
              }).href,
            },
          }),
          {
            body: {},
            status: 302,
            headers: {
              location: encodeURI(
                `${
                  appConfig.proConnectConfig.providerBaseUri
                }/login?${queryParamsAsString({
                  nonce,
                  state,
                })}`,
              ),
            },
          },
        );

        const codeSafir = "my-safir-code";
        const agency = new AgencyDtoBuilder().withCodeSafir(codeSafir).build();

        inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agency)];

        gateways.proConnectOAuthGateway.setAccessTokenResponse({
          type: "proConnect",
          accessToken: proConnectToken,
          expire: 1,
          idToken,
          payload: {
            email: "osef@gmail",
            firstName: "osef",
            lastName: "jean",
            nonce,
            structure_pe: codeSafir,
            siret: fakeProConnectSiret,
            sub: sub,
          },
        });

        const response =
          await authRoutesClient.afterEmailOrProConnectOAuthLogin({
            queryParams: {
              code: authCode,
              state,
            },
          });

        expectHttpResponseToEqual(response, {
          body: {},
          status: 302,
        });

        await eventCrawler.processNewEvents();

        const user = await inMemoryUow.userRepository.findByExternalId(sub);
        // biome-ignore lint/style/noNonNullAssertion: user is guaranteed to exist after successful OAuth
        const userId = user!.id;

        expectToEqual(inMemoryUow.agencyRepository.agencies, [
          toAgencyWithRights(
            { ...agency, updatedAt: gateways.timeGateway.now().toISOString() },
            {
              [userId]: { roles: ["validator"], isNotifiedByEmail: false },
            },
          ),
        ]);
      });
    });

    describe("Right path with email", () => {
      describe("handle all allowed user connection pages", () => {
        it.each(keys(allowedLoginSources))(`${displayRouteName(
          authRoutes.initiateLoginByEmail,
        )} 200 | EMAIL with connexion link > ${displayRouteName(
          authRoutes.afterEmailOrProConnectOAuthLogin,
        )} 200 > page %s with required connected user params`, async (source) => {
          const email: Email = "mail@email.com";
          const generatedUserId = "my-user-id";
          const uuids = [
            nonce,
            state,
            "aaaaaaaaaaa",
            "aaaaaaaaaab",
            generatedUserId,
          ];
          uuidGenerator.new = () => uuids.shift() ?? "no-uuid-provided";

          const redirectUri = frontRoutes[source]().href;

          expectHttpResponseToEqual(
            await authRoutesClient.initiateLoginByEmail({
              body: { email, redirectUri },
            }),
            {
              body: "",
              status: 200,
            },
          );

          await eventCrawler.processNewEvents();

          const notifications =
            inMemoryUow.notificationRepository.notifications;

          expect(notifications.length).toBe(1);
          const notification = notifications.at(0);
          if (!notification) throw new Error("missing notifification");
          if (notification.templatedContent.kind !== "LOGIN_BY_EMAIL_REQUESTED")
            throw new Error("bads notificiation kind");

          const code = decodeURIWithParams(
            notification.templatedContent.params.loginLink,
          ).params?.code;

          if (!code)
            throw new Error(
              `missing code on url ${notification.templatedContent.params.loginLink}`,
            );
          const response =
            await authRoutesClient.afterEmailOrProConnectOAuthLogin({
              queryParams: {
                code,
                state,
              },
            });

          if (response.status !== 200)
            throw errors.generic.testError("Response must be 200");

          expectHttpResponseToEqual(response, {
            body: {
              redirectUri: expect.any(String),
              provider: "email",
            },
            status: 200,
          });

          const { params } = decodeURIWithParams(
            (
              response as {
                status: 200;
                body: { redirectUri: string; provider: string };
              }
            ).body.redirectUri,
          );

          expectToEqual(params, {
            token: expect.any(String),
            provider: "email",
          });

          expectToEqual(
            decodeJwtWithoutSignatureCheck<{
              userId: string;
            }>(params?.token ?? "").userId,
            generatedUserId,
          );

          expectToEqual(inMemoryUow.userRepository.users, [
            {
              id: generatedUserId,
              createdAt: gateways.timeGateway.now().toISOString(),
              email,
              firstName: "",
              lastName: "",
              proConnect: null,
              lastLoginAt: gateways.timeGateway.now().toISOString(),
            },
          ]);

          expectToEqual(inMemoryUow.ongoingOAuthRepository.ongoingOAuths, [
            {
              provider: "email",
              userId: generatedUserId,
              nonce,
              state,
              usedAt: gateways.timeGateway.now(),
              email,
              fromUri: redirectUri,
            },
          ]);
        });
      });
    });

    describe("Right path with FT Connect", () => {
      const ftConnectAuthCode = "ft-connect-auth-code";
      const ftConnectAccessToken = "ft-connect-token";
      const ftConnectIdToken = "ft-connect-id-token";
      const ftConnectExternalId = "ft-connect-external-id";
      const conventionDraftId = "ft-connect-convention-draft-id";

      describe(displayRouteName(authRoutes.initiateLoginByOAuth), () => {
        it("redirects to FT Connect login and stores ongoing OAuth", async () => {
          const uuids = [nonce, state];
          uuidGenerator.new = () => uuids.shift() ?? "no-uuid-provided";

          const redirectUri = frontRoutes.conventionImmersion().href;

          expectHttpResponseToEqual(
            await authRoutesClient.initiateLoginByOAuth({
              queryParams: {
                provider: "ftConnect",
                redirectUri,
              },
            }),
            {
              body: {},
              status: 302,
              headers: {
                location: encodeURI(
                  `https://fake-ft-connect-login-url?${queryParamsAsString({
                    nonce,
                    state,
                  })}`,
                ),
              },
            },
          );

          expectToEqual(inMemoryUow.ongoingOAuthRepository.ongoingOAuths, [
            {
              provider: "ftConnect",
              nonce,
              state,
              usedAt: null,
              idToken: null,
              fromUri: redirectUri,
            },
          ]);
        });
      });

      describe(displayRouteName(authRoutes.afterFTConnectOAuthLogin), () => {
        it("redirects to convention immersion page with convention draft id", async () => {
          uuidGenerator.new = () => conventionDraftId;
          inMemoryUow.ongoingOAuthRepository.ongoingOAuths = [
            {
              provider: "ftConnect",
              nonce,
              state,
              usedAt: null,
              idToken: null,
              fromUri: frontRoutes.conventionImmersion().href,
            },
          ];
          gateways.ftConnectGateway.setAccessTokenResult({
            type: "ftConnect",
            accessToken: ftConnectAccessToken,
            expire: 1,
            idToken: ftConnectIdToken,
            payload: { nonce },
          });
          gateways.ftConnectGateway.setUser({
            isJobseeker: true,
            firstName: "Jean",
            lastName: "Dupont",
            birthdate: "1990-01-01",
            ftExternalId: ftConnectExternalId,
          });
          gateways.ftConnectGateway.setAdvisors([
            {
              type: "PLACEMENT",
              firstName: "Alice",
              lastName: "Martin",
              email: "conseiller@francetravail.fr",
            },
          ]);

          const response = await authRoutesClient.afterFTConnectOAuthLogin({
            queryParams: {
              code: ftConnectAuthCode,
              state,
            },
          });

          expectHttpResponseToEqual(response, {
            body: {},
            status: 302,
            headers: {
              location: `${appConfig.immersionFacileBaseUrl}${frontRoutes.conventionImmersion({ conventionDraftId, skipIntro: true }).href}`,
            },
          });

          expectToEqual(inMemoryUow.ongoingOAuthRepository.ongoingOAuths, [
            {
              provider: "ftConnect",
              nonce,
              state,
              usedAt: now,
              accessToken: ftConnectAccessToken,
              idToken: ftConnectIdToken,
              fromUri: frontRoutes.conventionImmersion().href,
            },
          ]);
          expectToEqual(
            inMemoryUow.conventionDraftRepository.conventionDrafts,
            [
              {
                id: conventionDraftId,
                internshipKind: "immersion",
                fromFtConnectedUser: true,
                updatedAt: gateways.timeGateway.now().toISOString(),
                signatories: {
                  beneficiary: {
                    firstName: "Jean",
                    lastName: "Dupont",
                    birthdate: "1990-01-01",
                    federatedIdentity: {
                      provider: "ftConnect",
                      token: ftConnectExternalId,
                    },
                  },
                },
                validators: {
                  agencyCounsellor: {
                    firstname: "Alice",
                    lastname: "Martin",
                  },
                },
              },
            ],
          );
        });

        it("redirects to managed FT Connect error page when FT Connect throws a managed error", async () => {
          inMemoryUow.ongoingOAuthRepository.ongoingOAuths = [
            {
              provider: "ftConnect",
              nonce,
              state,
              usedAt: null,
              idToken: null,
              fromUri: `/${frontRoutes.conventionImmersion().href}`,
            },
          ];
          gateways.ftConnectGateway.getAccessToken = async () => {
            throw new ManagedFTConnectError("ftConnectNoAuthorisation");
          };

          const response = await authRoutesClient.afterFTConnectOAuthLogin({
            queryParams: {
              code: ftConnectAuthCode,
              state,
            },
          });

          expectHttpResponseToEqual(response, {
            body: {},
            status: 302,
            headers: {
              location: `${appConfig.immersionFacileBaseUrl}${frontRoutes.temporaryError().href}`,
            },
          });
        });

        it("redirects to raw FT Connect error page when FT Connect throws a raw error", async () => {
          const rawErrorTitle = "Erreur France Travail";
          const rawErrorMessage = "Le service France Travail est indisponible";
          inMemoryUow.ongoingOAuthRepository.ongoingOAuths = [
            {
              provider: "ftConnect",
              nonce,
              state,
              usedAt: null,
              idToken: null,
              fromUri: `/${frontRoutes.conventionImmersion().href}`,
            },
          ];
          gateways.ftConnectGateway.getAccessToken = async () => {
            throw new FTConnectError(rawErrorTitle, rawErrorMessage);
          };

          const response = await authRoutesClient.afterFTConnectOAuthLogin({
            queryParams: {
              code: ftConnectAuthCode,
              state,
            },
          });

          expectHttpResponseToEqual(response, {
            body: {},
            status: 302,
            headers: {
              location: `${appConfig.immersionFacileBaseUrl}${frontRoutes.temporaryError({ title: rawErrorTitle, message: rawErrorMessage }).href}`,
            },
          });
        });
      });
    });

    describe(`${displayRouteName(
      authRoutes.getOAuthLogoutUrl,
    )} returns the logout url`, () => {
      const user = new UserBuilder()
        .withProConnectInfos({ externalId: "id", siret: "00000000000000" })
        .build();

      beforeEach(() => {
        inMemoryUow.userRepository.users = [user];
      });

      describe("when provider is 'proConnect'", () => {
        it("returns 401 if authorization header is missing", async () => {
          const response = await authRoutesClient.getOAuthLogoutUrl({
            headers: { authorization: "" },
          });

          expectHttpResponseToEqual(response, {
            status: 401,
            body: {
              status: 401,
              message: "Veuillez vous authentifier",
            },
          });
        });

        it("returns 401 when user does not exist", async () => {
          inMemoryUow.userRepository.users = [];

          const token = generateConnectedUserJwt({
            userId: "missing-user-id",
            version: currentJwtVersions.connectedUser,
          });

          const response = await authRoutesClient.getOAuthLogoutUrl({
            headers: { authorization: token },
          });

          expectHttpResponseToEqual(response, {
            status: 401,
            body: {
              status: 401,
              message: invalidTokenMessage,
            },
          });
        });

        it("returns a correct logout url with status 200", async () => {
          const state = "fake-state";
          inMemoryUow.ongoingOAuthRepository.ongoingOAuths = [
            {
              fromUri: "uri",
              userId: user.id,
              accessToken: "yolo",
              provider: "proConnect",
              state,
              nonce: "fake-nonce",
              externalId: user.proConnect?.externalId,
              usedAt: null,
              idToken: "idtoken",
            },
          ];

          const token = generateConnectedUserJwt({
            userId: user.id,
            version: currentJwtVersions.connectedUser,
          });

          const response = await authRoutesClient.getOAuthLogoutUrl({
            headers: { authorization: token },
          });

          expectHttpResponseToEqual(response, {
            body: `${
              appConfig.proConnectConfig.providerBaseUri
            }${fakeProConnectLogoutUri}?${queryParamsAsString({
              postLogoutRedirectUrl: appConfig.immersionFacileBaseUrl,
              idToken: "idtoken",
              state,
            })}`,
            status: 200,
          });
        });
      });

      describe("when provider is 'ftConnect'", () => {
        it("when ftConnect, returns an error with status 400", async () => {
          inMemoryUow.ongoingOAuthRepository.ongoingOAuths = [
            {
              fromUri: "uri",
              userId: user.id,
              accessToken: "yolo",
              provider: "ftConnect",
              state,
              nonce: "fake-nonce",
              externalId: user.proConnect?.externalId,
              usedAt: null,
              idToken: "id-token",
            },
          ];

          const token = generateConnectedUserJwt({
            userId: user.id,
            version: currentJwtVersions.connectedUser,
          });

          const response = await authRoutesClient.getOAuthLogoutUrl({
            headers: { authorization: token },
          });

          expectHttpResponseToEqual(response, {
            body: {
              message: errors.auth.accessTokenErrorType({
                actualType: "ftConnect",
                expectedType: "proConnect",
              }).message,
              status: 400,
            },
            status: 400,
          });
        });
      });
    });
  });

  describe("user routes", () => {
    const agencyUser: User = {
      id: "123",
      email: "joe@mail.com",
      firstName: "Joe",
      lastName: "Doe",
      proConnect: defaultProConnectInfos,
      createdAt: new Date().toISOString(),
    };
    const agency = new AgencyDtoBuilder().withKind("france-travail").build();

    describe("/inclusion-connected/user", () => {
      const agency = new AgencyDtoBuilder().withKind("france-travail").build();
      const agencyForUsers = toAgencyDtoForAgencyUsersAndAdmins(agency, []);

      it(`${displayRouteName(
        authRoutes.getConnectedUser,
      )} 200 with agency dashboard url on response body`, async () => {
        const convention = new ConventionDtoBuilder()
          .withEstablishmentRepresentativeEmail(agencyUser.email)
          .build();

        inMemoryUow.conventionRepository.setConventions([convention]);
        inMemoryUow.userRepository.users = [agencyUser];
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [agencyUser.id]: {
              roles: ["validator"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        const response = await authRoutesClient.getConnectedUser({
          queryParams: {},
          headers: {
            authorization: generateConnectedUserJwt({
              userId: agencyUser.id,
              version: currentJwtVersions.connectedUser,
            }),
          },
        });

        expectHttpResponseToEqual(response, {
          body: {
            ...agencyUser,
            dashboards: {
              agencies: {
                agencyDashboardUrl: `http://stub-metabasev1/AgencyUserDashboard/${
                  agencyUser.id
                }/${gateways.timeGateway.now()}`,
                erroredConventionsDashboardUrl: `http://stubErroredConventionDashboard/${
                  agencyUser.id
                }/${gateways.timeGateway.now()}`,
                statsEstablishmentDetailsUrl: `http://stub-metabasev1/EstablishmentDashboard/${gateways.timeGateway.now()}`,
                agencyManagement: `http://stub-metabasev2/ManageMyAgency/${gateways.timeGateway.now()}/${agency.name}`,
                establishmentManagement: `http://stub-metabasev2/ManageMyEstablishments/${gateways.timeGateway.now()}`,
              },
              establishments: {
                conventions: `http://stubEstablishmentConventionsDashboardUrl/${
                  agencyUser.id
                }/${gateways.timeGateway.now()}`,
                discussions: null,
              },
            },
            agencyRights: [
              {
                agency: agencyForUsers,
                roles: ["validator"],
                isNotifiedByEmail: true,
              },
            ],
          },
          status: 200,
        });
      });

      it(`${displayRouteName(
        authRoutes.getConnectedUser,
      )} 400 without headers`, async () => {
        const response = await authRoutesClient.getConnectedUser({
          headers: {} as any,
          queryParams: {},
        });
        expectHttpResponseToEqual(response, {
          body: {
            issues: [
              "authorization : Invalid input: expected string, received undefined",
            ],
            message:
              "Shared-route schema 'headersSchema' was not respected in adapter 'express'.\nRoute: GET /inclusion-connected/user",
            status: 400,
          },
          status: 400,
        });
      });

      it(`${displayRouteName(
        authRoutes.getConnectedUser,
      )} 401 with bad token`, async () => {
        const response = await authRoutesClient.getConnectedUser({
          headers: { authorization: "wrong-token" },
          queryParams: {},
        });

        expectHttpResponseToEqual(response, {
          body: { message: invalidTokenMessage, status: 401 },
          status: 401,
        });
      });

      it(`${displayRouteName(
        authRoutes.getConnectedUser,
      )} 401 with expired token`, async () => {
        const userId = "123";
        const token = generateConnectedUserJwt(
          { userId, version: currentJwtVersions.connectedUser },
          0,
        );

        const response = await authRoutesClient.getConnectedUser({
          headers: { authorization: token },
          queryParams: {},
        });

        expectHttpResponseToEqual(response, {
          body: { message: authExpiredMessage(), status: 401 },
          status: 401,
        });
      });
    });

    describe(`${displayRouteName(
      authRoutes.getConnectedUsers,
    )} List connected users`, () => {
      it("200 - Gets the list of connected users with role 'to-review'", async () => {
        inMemoryUow.userRepository.users = [agencyUser];
        inMemoryUow.agencyRepository.agencies = [
          toAgencyWithRights(agency, {
            [agencyUser.id]: {
              roles: ["agency-admin"],
              isNotifiedByEmail: true,
            },
          }),
        ];

        const response = await authRoutesClient.getConnectedUsers({
          queryParams: { agencyIds: [agency.id] },
          headers: {
            authorization: generateConnectedUserJwt({
              userId: agencyUser.id,
              version: currentJwtVersions.connectedUser,
            }),
          },
        });

        const { validatorEmails: _, counsellorEmails: __, ...rest } = agency;

        expectHttpResponseToEqual(response, {
          status: 200,
          body: [
            {
              ...agencyUser,
              agencyRights: [
                {
                  agency: {
                    ...rest,
                    admins: [agencyUser.email],
                  },
                  roles: ["agency-admin"],
                  isNotifiedByEmail: true,
                },
              ],
              dashboards: {
                agencies: noAgencyDashboards,
                establishments: noEstablishmentDashboard,
              },
            },
          ],
        });
      });

      it("401 - missing token", async () => {
        const response = await authRoutesClient.getConnectedUsers({
          queryParams: { agencyRole: "to-review" },
          headers: { authorization: "" },
        });
        expectHttpResponseToEqual(response, {
          status: 401,
          body: { status: 401, message: "Veuillez vous authentifier" },
        });
      });
    });
  });

  describe("renew jwt", () => {
    describe(`${displayRouteName(
      authRoutes.renewExpiredJwt,
    )} renews a jwt1`, () => {
      describe("convention jwt", () => {
        it("200 - sends the updated magic link", async () => {
          uuidGenerator.new = () => uuid();
          const validConvention = new ConventionDtoBuilder().build();

          const agency = AgencyDtoBuilder.create(validConvention.agencyId)
            .withName("TEST-name")
            .withSignature("TEST-signature")
            .build();

          const convention = new ConventionDtoBuilder().build();
          inMemoryUow.conventionRepository.setConventions([convention]);
          inMemoryUow.agencyRepository.agencies = [toAgencyWithRights(agency)];

          gateways.timeGateway.setNextDate(new Date());

          generateConventionJwt = makeGenerateJwtES256<"convention">(
            appConfig.jwtPrivateKey,
            3600 * 24, // one day
          );
          const shortLinkIds = ["shortLink1", "shortLinkg2"];
          gateways.shortLinkGenerator.addMoreShortLinkIds(shortLinkIds);

          const originalUrl = makeRouteAbsoluteUrl({
            route: frontRoutes.conventionToSign({ jwt: "" }),
            baseUrl: appConfig.immersionFacileBaseUrl,
          });

          const expiredJwt = generateConventionJwt(
            createConventionMagicLinkPayload({
              id: validConvention.id,
              role: "beneficiary",
              email: validConvention.signatories.beneficiary.email,
              now: new Date(),
            }),
          );

          const response = await authRoutesClient.renewExpiredJwt({
            queryParams: {
              kind: "convention",
              expiredJwt,
              originalUrl: encodeURIComponent(originalUrl),
            },
          });

          expect(response.status).toBe(200);

          await processEventsForEmailToBeSent(eventCrawler);

          const sentEmails = gateways.notification.getSentEmails();

          expect(sentEmails).toHaveLength(1);

          const email = expectEmailOfType(sentEmails[0], "MAGIC_LINK_RENEWAL");
          expect(email.recipients).toEqual([
            validConvention.signatories.beneficiary.email,
          ]);

          const magicLink = await shortLinkRedirectToLinkWithValidation(
            email.params.magicLink,
            technicalRoutesClient,
          );

          expect(magicLink.startsWith(originalUrl)).toBeTruthy();
          const renewedJwt = magicLink.replace(originalUrl, "");
          expect(renewedJwt !== expiredJwt).toBeTruthy();
          expect(
            makeVerifyJwtES256(appConfig.jwtPublicKey)(renewedJwt),
          ).toBeDefined();
        });

        it("400 - renew not allowed for back-office", async () => {
          const convention = new ConventionDtoBuilder()
            .withFederatedIdentity({ provider: "ftConnect", token: "some-id" })
            .build();
          inMemoryUow.conventionRepository.setConventions([convention]);
          inMemoryUow.agencyRepository.agencies = [
            toAgencyWithRights(
              AgencyDtoBuilder.create(convention.agencyId)
                .withName("TEST-name")
                .withSignature("TEST-signature")
                .build(),
            ),
          ];
          gateways.timeGateway.setNextDate(new Date());

          generateConventionJwt = makeGenerateJwtES256<"convention">(
            appConfig.jwtPrivateKey,
            3600 * 24, // one day
          );

          const unsupportedRole: Role = "back-office";

          const response = await authRoutesClient.renewExpiredJwt({
            queryParams: {
              kind: "convention",
              expiredJwt: generateConventionJwt(
                createConventionMagicLinkPayload({
                  id: convention.id,
                  role: unsupportedRole as ConventionRole,
                  email: convention.establishmentTutor.email,
                  now: gateways.timeGateway.now(),
                }),
              ),
              originalUrl: makeRouteAbsoluteUrl({
                route: frontRoutes.assessment({ jwt: "fake-jwt" }),
                baseUrl: appConfig.immersionFacileBaseUrl,
              }),
            },
          });

          expectHttpResponseToEqual(response, {
            status: 400,
            body: {
              message: errors.convention.roleHasNoMagicLink({
                role: unsupportedRole,
              }).message,
              status: 400,
            },
          });
        });

        it("403 - renew forbidden case on missing OAuth", async () => {
          const user = new UserBuilder().build();

          gateways.timeGateway.setNextDate(new Date());

          inMemoryUow.userRepository.users = [user];

          const response = await authRoutesClient.renewExpiredJwt({
            queryParams: {
              kind: "connectedUser",
              expiredJwt: generateConnectedUserJwt(
                createConnectedUserJwtPayload({
                  userId: user.id,
                  now: gateways.timeGateway.now(),
                  durationHours: 1,
                }),
              ),
            },
          });

          expectHttpResponseToEqual(response, {
            status: 403,
            body: {
              message: errors.auth.missingOAuth({}).message,
              status: 403,
            },
          });
        });
      });
    });
  });
});
