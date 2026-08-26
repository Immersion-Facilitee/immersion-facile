import { subDays } from "date-fns";
import { keys } from "ramda";
import {
  AgencyDtoBuilder,
  allowedLoginSources,
  type ExternalId,
  errors,
  expectObjectInArrayToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  frontRoutes,
  makeRouteAbsoluteUrl,
  type OAuthSuccessLoginParams,
  type SiretDto,
  type UserWithAdminRights,
} from "shared";
import { v4 as uuid } from "uuid";
import { toAgencyWithRights } from "../../../../../utils/agency";
import { generateES256KeyPair } from "../../../../../utils/jwt";
import { fakeGenerateConnectedUserUrlFn } from "../../../../../utils/jwtTestHelper";
import { makeCreateNewEvent } from "../../../events/ports/EventBus";
import { makeGenerateJwtES256, makeVerifyJwtES256 } from "../../../jwt";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../uuid-generator/adapters/UuidGeneratorImplementations";
import { InMemoryFtConnectGateway } from "../../ft-connect/adapters/ft-connect-gateway/InMemoryFtConnectGateway";
import type {
  FtConnectAdvisorDto,
  FtConnectImmersionAdvisorDto,
} from "../../ft-connect/dto/FtConnectAdvisor.dto";
import type { FtConnectUserDto } from "../../ft-connect/dto/FtConnectUserDto";
import {
  fakeProviderConfig,
  InMemoryProConnectOAuthGateway,
} from "../adapters/oauth-gateway/InMemoryOAuthGateway";
import type { IdToken, OngoingOAuth } from "../entities/OngoingOAuth";
import type {
  FTConnectGetAccessTokenPayload,
  ProConnectGetAccessTokenPayload,
} from "../port/OAuthGateway";
import {
  type AfterOAuthSuccess,
  makeAfterOAuthSuccess,
} from "./AfterOAuthSuccess";

describe("AfterOAuthSuccessRedirection use case", () => {
  const immersionFacileBaseUrl = "http://baseUrl";
  const { publicKey, privateKey } = generateES256KeyPair();

  const generateEmailAuthCode = makeGenerateJwtES256<"emailAuthCode">(
    privateKey,
    60 * 60, // 1 hour expiration
  );

  const defaultExpectedProConnectIcIdTokenPayload: ProConnectGetAccessTokenPayload =
    {
      nonce: "nounce",
      sub: "my-user-external-id",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@mail.com",
      siret: "12345678901234",
    };

  const defaultExpectedIftConnectcIdTokenPayload: FTConnectGetAccessTokenPayload =
    {
      nonce: "nounce",
    };

  let uow: InMemoryUnitOfWork;
  let proConnectOAuthGateway: InMemoryProConnectOAuthGateway;
  let ftConnectGateway: InMemoryFtConnectGateway;
  let uuidGenerator: TestUuidGenerator;
  let afterOAuthSuccessRedirection: AfterOAuthSuccess;
  let timeGateway: CustomTimeGateway;

  beforeEach(() => {
    uow = createInMemoryUow();
    uuidGenerator = new TestUuidGenerator();
    proConnectOAuthGateway = new InMemoryProConnectOAuthGateway(
      fakeProviderConfig,
    );
    ftConnectGateway = new InMemoryFtConnectGateway();
    timeGateway = new CustomTimeGateway();
    const verifyEmailAuthCode = makeVerifyJwtES256<"emailAuthCode">(publicKey);

    afterOAuthSuccessRedirection = makeAfterOAuthSuccess({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        createNewEvent: makeCreateNewEvent({
          timeGateway: timeGateway,
          uuidGenerator,
        }),
        proConnectOAuthGateway: proConnectOAuthGateway,
        ftConnectGateway,
        uuidGenerator,
        generateConnectedUserLoginUrl: fakeGenerateConnectedUserUrlFn,
        verifyEmailAuthCodeJwt: verifyEmailAuthCode,
        immersionFacileBaseUrl,
        timeGateway,
      },
    });
  });

  describe("With OAuthGateway provider 'proConnect'", () => {
    describe("right paths", () => {
      describe("when user had never connected before", () => {
        it("saves the user as Authenticated user", async () => {
          const { initialOngoingOAuth, userId } =
            makeSuccessfulAuthenticationConditions("admin");

          await afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: initialOngoingOAuth.state,
          });

          expectToEqual(uow.userRepository.users, [
            {
              id: userId,
              firstName: defaultExpectedProConnectIcIdTokenPayload.firstName,
              lastName: defaultExpectedProConnectIcIdTokenPayload.lastName,
              email: defaultExpectedProConnectIcIdTokenPayload.email,
              proConnect: {
                externalId: defaultExpectedProConnectIcIdTokenPayload.sub,
                siret: defaultExpectedProConnectIcIdTokenPayload.siret,
              },
              createdAt: timeGateway.now().toISOString(),
              preventToDelete: false,
              lastLoginAt: timeGateway.now().toISOString(),
            },
          ]);
        });

        it("updates ongoingOAuth with userId, accessToken and externalId", async () => {
          const { accessToken, initialOngoingOAuth, userId, idToken } =
            makeSuccessfulAuthenticationConditions("admin");

          await afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: initialOngoingOAuth.state,
          });

          expectToEqual(uow.ongoingOAuthRepository.ongoingOAuths, [
            {
              ...initialOngoingOAuth,
              usedAt: timeGateway.now(),
              accessToken,
              idToken,
              userId,
              externalId: defaultExpectedProConnectIcIdTokenPayload.sub,
            },
          ]);
        });

        it("saves UserConnectedSuccessfully event with relevant data", async () => {
          const { initialOngoingOAuth, userId } =
            makeSuccessfulAuthenticationConditions("admin");

          await afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: initialOngoingOAuth.state,
          });

          expectObjectInArrayToMatch(uow.outboxRepository.events, [
            {
              topic: "UserAuthenticatedSuccessfully",
              payload: {
                userId,
                codeSafir: null,
                triggeredBy: {
                  kind: "connected-user",
                  userId,
                },
              },
            },
          ]);
        });
      });

      describe("when user has already exists as an Authenticated User", () => {
        it("updates the user as Authenticated user", async () => {
          const { initialOngoingOAuth } =
            makeSuccessfulAuthenticationConditions("admin");
          const { alreadyExistingUser } =
            addAlreadyExistingAuthenticatedUserInRepo();

          expectToEqual(uow.userRepository.users, [alreadyExistingUser]);

          await afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: initialOngoingOAuth.state,
          });

          expectToEqual(uow.userRepository.users, [
            {
              ...alreadyExistingUser,
              email: defaultExpectedProConnectIcIdTokenPayload.email,
              firstName: defaultExpectedProConnectIcIdTokenPayload.firstName,
              lastName: defaultExpectedProConnectIcIdTokenPayload.lastName,
              lastLoginAt: timeGateway.now().toISOString(),
            },
          ]);
        });
        it("also work if the existing user was not connected through oAuth (no externalId)", async () => {
          const { alreadyExistingUser } =
            addAlreadyExistingAuthenticatedUserInRepo({
              externalId: null,
            });
          const { initialOngoingOAuth } =
            makeSuccessfulAuthenticationConditions("agencyDashboard", {
              email: alreadyExistingUser.email,
            });

          expectToEqual(uow.userRepository.users, [
            {
              ...alreadyExistingUser,
              proConnect: null,
            },
          ]);

          await afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: initialOngoingOAuth.state,
          });

          expectToEqual(uow.userRepository.users, [
            {
              id: alreadyExistingUser.id,
              email: alreadyExistingUser.email,
              firstName: defaultExpectedProConnectIcIdTokenPayload.firstName,
              lastName: defaultExpectedProConnectIcIdTokenPayload.lastName,
              proConnect: {
                externalId: defaultExpectedProConnectIcIdTokenPayload.sub,
                siret: defaultExpectedProConnectIcIdTokenPayload.siret,
              },
              createdAt: alreadyExistingUser.createdAt,
              preventToDelete: false,
              lastLoginAt: timeGateway.now().toISOString(),
            },
          ]);
        });

        it("keeps preventToDelete when existing user", async () => {
          const { alreadyExistingUser } =
            addAlreadyExistingAuthenticatedUserInRepo({
              externalId: null,
              preventToDelete: true,
            });
          const { initialOngoingOAuth } =
            makeSuccessfulAuthenticationConditions("agencyDashboard", {
              email: alreadyExistingUser.email,
            });

          await afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: initialOngoingOAuth.state,
          });

          expectToEqual(uow.userRepository.users, [
            {
              id: alreadyExistingUser.id,
              email: alreadyExistingUser.email,
              firstName: defaultExpectedProConnectIcIdTokenPayload.firstName,
              lastName: defaultExpectedProConnectIcIdTokenPayload.lastName,
              proConnect: {
                externalId: defaultExpectedProConnectIcIdTokenPayload.sub,
                siret: defaultExpectedProConnectIcIdTokenPayload.siret,
              },
              createdAt: alreadyExistingUser.createdAt,
              preventToDelete: true,
              lastLoginAt: timeGateway.now().toISOString(),
            },
          ]);
        });

        it("when user change its email on oAuth provider", async () => {
          const externalId = uuid();

          const initialUser: UserWithAdminRights = {
            id: uuid(),
            email: "initial@mail.com",
            proConnect: {
              externalId,
              siret: "0000",
            },
            firstName: "Billy",
            lastName: "Idol",
            createdAt: new Date().toISOString(),
            preventToDelete: false,
          };

          const previousMigrationUserWithUpdatedEmail: UserWithAdminRights = {
            id: uuid(),
            email: "updated@mail.com",
            proConnect: null,
            firstName: "",
            lastName: "",
            createdAt: new Date().toISOString(),
            preventToDelete: false,
          };

          uow.userRepository.users = [
            initialUser,
            previousMigrationUserWithUpdatedEmail,
          ];

          const agency1 = toAgencyWithRights(
            new AgencyDtoBuilder().withId(uuid()).build(),
            {
              [initialUser.id]: {
                isNotifiedByEmail: false,
                roles: ["counsellor"],
              },
              [previousMigrationUserWithUpdatedEmail.id]: {
                isNotifiedByEmail: true,
                roles: ["validator"],
              },
            },
          );
          const agency2 = toAgencyWithRights(
            new AgencyDtoBuilder().withId(uuid()).build(),
            {
              [previousMigrationUserWithUpdatedEmail.id]: {
                isNotifiedByEmail: true,
                roles: ["counsellor"],
              },
            },
          );

          uow.agencyRepository.agencies = [agency1, agency2];

          const updatedUser: UserWithAdminRights = {
            id: initialUser.id,
            email: previousMigrationUserWithUpdatedEmail.email,
            firstName: "Martine",
            lastName: "Duflot",
            proConnect: {
              externalId,
              siret: defaultExpectedProConnectIcIdTokenPayload.siret,
            },
            createdAt: initialUser.createdAt,
            preventToDelete: false,
            lastLoginAt: timeGateway.now().toISOString(),
          };

          await afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: makeSuccessfulAuthenticationConditions("agencyDashboard", {
              email: updatedUser.email,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              sub: externalId,
            }).initialOngoingOAuth.state,
          });

          expectToEqual(uow.userRepository.users, [updatedUser]);
          expectToEqual(uow.agencyRepository.agencies, [
            {
              ...agency1,
              updatedAt: timeGateway.now().toISOString(),
              usersRights: {
                [initialUser.id]: {
                  isNotifiedByEmail: true,
                  roles: ["counsellor", "validator"],
                },
              },
            },
            {
              ...agency2,
              updatedAt: timeGateway.now().toISOString(),
              usersRights: {
                [initialUser.id]: {
                  isNotifiedByEmail: true,
                  roles: ["counsellor"],
                },
              },
            },
          ]);
        });

        it("when user select another siret on ProConnect", async () => {
          const externalId: ExternalId = "id";
          const initialUser: UserWithAdminRights = {
            id: uuid(),
            email: "initial@mail.com",
            proConnect: {
              externalId,
              siret: "00000000000000",
            },
            firstName: "Billy",
            lastName: "Idol",
            createdAt: new Date().toISOString(),
            preventToDelete: false,
          };

          uow.userRepository.users = [initialUser];

          const proConnectSiret: SiretDto = "55555666667777";

          await afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: makeSuccessfulAuthenticationConditions("agencyDashboard", {
              email: initialUser.email,
              firstName: initialUser.firstName,
              lastName: initialUser.lastName,
              sub: initialUser.proConnect?.externalId,
              siret: proConnectSiret,
            }).initialOngoingOAuth.state,
          });

          expectToEqual(uow.userRepository.users, [
            {
              ...initialUser,
              proConnect: {
                externalId,
                siret: proConnectSiret,
              },
              lastLoginAt: timeGateway.now().toISOString(),
            },
          ]);
        });
      });

      describe("handle dynamic login pages", () => {
        it.each(
          keys(allowedLoginSources),
        )("generates an app token and returns a redirection url which includes token and user data for %s", async (source) => {
          const allowedRoute = allowedLoginSources[source];
          const { initialOngoingOAuth, userId } =
            makeSuccessfulAuthenticationConditions(allowedRoute({}).href);

          const response = await afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: initialOngoingOAuth.state,
          });

          expectToEqual(response, {
            provider: "proConnect",
            redirectUri: `http://fake-connected-user${allowedRoute({ token: `jwt-${userId}`, provider: "proConnect" }).href}`,
          });
        });
      });
    });

    describe("wrong paths", () => {
      const accessToken = "access-token";
      const idToken: IdToken = "id-token";

      it("rejects the connection if no state match the provided one in DB", async () => {
        proConnectOAuthGateway.setAccessTokenResponse({
          type: "proConnect",
          expire: 60,
          payload: defaultExpectedProConnectIcIdTokenPayload,
          accessToken,
          idToken,
        });

        const params: OAuthSuccessLoginParams = {
          code: "my-code",
          state: "my-state",
        };

        await expectPromiseToFailWithError(
          afterOAuthSuccessRedirection.execute(params),
          errors.auth.missingOAuth({
            state: params.state,
          }),
        );
      });

      it("should raise a Forbidden error if the nonce does not match", async () => {
        const existingNonce = "existing-nonce";
        const initialOngoingOAuth: OngoingOAuth = {
          fromUri: "agencyDashboard",
          provider: "proConnect",
          state: "my-state",
          nonce: existingNonce,
          usedAt: null,
          idToken: null,
        };
        uow.ongoingOAuthRepository.ongoingOAuths = [initialOngoingOAuth];

        proConnectOAuthGateway.setAccessTokenResponse({
          type: "proConnect",
          expire: 60,
          payload: defaultExpectedProConnectIcIdTokenPayload,
          accessToken,
          idToken,
        });

        await expectPromiseToFailWithError(
          afterOAuthSuccessRedirection.execute({
            code: "my-code",
            state: "my-state",
          }),
          errors.auth.nonceMismatch(),
        );
      });
    });
  });

  describe("With OAuthGateway provider 'ftConnect'", () => {
    const code = "my-code";
    const state = "my-state";
    const accessToken = "access-token";
    const idToken: IdToken = "id-token";

    const ftPlacementAdvisor: FtConnectImmersionAdvisorDto = {
      type: "PLACEMENT",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@mail.com",
    };
    const ftIndemnisationAdvisor: FtConnectAdvisorDto = {
      email: "017jean.dupont@france-travail.net",
      firstName: "Jean",
      lastName: "Dupont",
      type: "INDEMNISATION",
    };
    const ftCapEmploiAdvisor: FtConnectImmersionAdvisorDto = {
      email: "elsa.oldenburg@france-travail.net",
      lastName: "Oldenburg",
      firstName: "Elsa",
      type: "CAPEMPLOI",
    };
    const ftJobseekerUser: FtConnectUserDto = {
      isJobseeker: true,
      firstName: "John",
      lastName: "Doe",
      birthdate: "1990-01-01",
      ftExternalId: "123",
    };
    const ftNotJobseekerUser: FtConnectUserDto = {
      isJobseeker: false,
      firstName: "Jane",
      lastName: "Joe",
      birthdate: "1990-01-01",
      ftExternalId: "456",
    };
    const defaultFtOngoingOAuth: OngoingOAuth = {
      fromUri: frontRoutes.conventionImmersion().href,
      provider: "ftConnect",
      state,
      nonce: "nounce",
      usedAt: null,
      idToken: null,
    };

    describe("right paths", () => {
      const conventionDraftId = "my-id";

      beforeEach(() => {
        uow.ongoingOAuthRepository.ongoingOAuths = [defaultFtOngoingOAuth];
        uow.conventionDraftRepository.conventionDrafts = [];
        ftConnectGateway.setAccessTokenResult({
          type: "ftConnect",
          expire: 60,
          payload: defaultExpectedIftConnectcIdTokenPayload,
          accessToken,
          idToken,
        });
        ftConnectGateway.setUser(ftJobseekerUser);
        uuidGenerator.setNextUuid(conventionDraftId);
      });

      it("updates the authenticated user and create convention draft with advisor", async () => {
        ftConnectGateway.setAdvisors([
          ftPlacementAdvisor,
          ftIndemnisationAdvisor,
        ]);

        const response = await afterOAuthSuccessRedirection.execute({
          code,
          state,
        });
        expectToEqual(uow.ongoingOAuthRepository.ongoingOAuths, [
          {
            ...defaultFtOngoingOAuth,
            provider: "ftConnect",
            accessToken,
            idToken,
            usedAt: timeGateway.now(),
          },
        ]);
        expectToEqual(uow.conventionDraftRepository.conventionDrafts, [
          {
            id: conventionDraftId,
            internshipKind: "immersion",
            fromFtConnectedUser: true,
            updatedAt: timeGateway.now().toISOString(),
            signatories: {
              beneficiary: {
                firstName: ftJobseekerUser.firstName,
                lastName: ftJobseekerUser.lastName,
                email: ftJobseekerUser.email,
                birthdate: ftJobseekerUser.birthdate,
                phone: ftJobseekerUser.phone,
                federatedIdentity: {
                  provider: "ftConnect",
                  token: ftJobseekerUser.ftExternalId,
                },
              },
            },
            validators: {
              agencyCounsellor: {
                firstname: ftPlacementAdvisor.firstName,
                lastname: ftPlacementAdvisor.lastName,
              },
            },
          },
        ]);
        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          {
            topic: "FTConnectedSuccessfully",
            payload: {
              ftConnectUserId: ftJobseekerUser.ftExternalId,
              conventionDraftId,
            },
          },
        ]);
        expectToEqual(
          uow.conventionFranceTravailAdvisorRepository
            .conventionFranceTravailUsers,
          {},
        );
        expectToEqual(response, {
          provider: "ftConnect",
          redirectUri: `http://baseUrl${frontRoutes.conventionImmersion({ conventionDraftId, skipIntro: true }).href}`,
        });
      });

      it("updates the authenticated user and use preferred capemploi advisor among other advisor types", async () => {
        ftConnectGateway.setAdvisors([
          ftPlacementAdvisor,
          ftCapEmploiAdvisor,
          ftIndemnisationAdvisor,
        ]);

        const response = await afterOAuthSuccessRedirection.execute({
          code,
          state,
        });

        expectToEqual(uow.ongoingOAuthRepository.ongoingOAuths, [
          {
            ...defaultFtOngoingOAuth,
            accessToken,
            idToken,
            usedAt: timeGateway.now(),
          },
        ]);
        expectToEqual(uow.conventionDraftRepository.conventionDrafts, [
          {
            id: conventionDraftId,
            internshipKind: "immersion",
            fromFtConnectedUser: true,
            updatedAt: timeGateway.now().toISOString(),
            signatories: {
              beneficiary: {
                firstName: ftJobseekerUser.firstName,
                lastName: ftJobseekerUser.lastName,
                email: ftJobseekerUser.email,
                birthdate: ftJobseekerUser.birthdate,
                phone: ftJobseekerUser.phone,
                federatedIdentity: {
                  provider: "ftConnect",
                  token: ftJobseekerUser.ftExternalId,
                },
              },
            },
            validators: {
              agencyCounsellor: {
                firstname: ftCapEmploiAdvisor.firstName,
                lastname: ftCapEmploiAdvisor.lastName,
              },
            },
          },
        ]);
        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          {
            topic: "FTConnectedSuccessfully",
            payload: {
              ftConnectUserId: ftJobseekerUser.ftExternalId,
              conventionDraftId,
            },
          },
        ]);
        expectToEqual(response, {
          provider: "ftConnect",
          redirectUri: `http://baseUrl${frontRoutes.conventionImmersion({ conventionDraftId, skipIntro: true }).href}`,
        });
      });

      it("should still redirect correctly when FtConnected and is not jobseeker", async () => {
        uow.ongoingOAuthRepository.ongoingOAuths = [defaultFtOngoingOAuth];
        ftConnectGateway.setAccessTokenResult({
          type: "ftConnect",
          expire: 60,
          payload: defaultExpectedIftConnectcIdTokenPayload,
          accessToken,
          idToken,
        });
        ftConnectGateway.setUser(ftNotJobseekerUser);
        ftConnectGateway.setAdvisors([
          ftPlacementAdvisor,
          ftIndemnisationAdvisor,
        ]);
        uuidGenerator.setNextUuid(conventionDraftId);

        const response = await afterOAuthSuccessRedirection.execute({
          code,
          state,
        });

        expectToEqual(uow.ongoingOAuthRepository.ongoingOAuths, [
          {
            ...defaultFtOngoingOAuth,
            accessToken,
            idToken,
            usedAt: timeGateway.now(),
          },
        ]);
        expectToEqual(uow.conventionDraftRepository.conventionDrafts, [
          {
            id: conventionDraftId,
            internshipKind: "immersion",
            fromFtConnectedUser: true,
            updatedAt: timeGateway.now().toISOString(),
            signatories: {
              beneficiary: {
                firstName: ftNotJobseekerUser.firstName,
                lastName: ftNotJobseekerUser.lastName,
                email: ftNotJobseekerUser.email,
                birthdate: ftNotJobseekerUser.birthdate,
                phone: ftNotJobseekerUser.phone,
                federatedIdentity: {
                  provider: "ftConnect",
                  token: ftNotJobseekerUser.ftExternalId,
                },
              },
            },
            validators: undefined,
          },
        ]);
        expectObjectInArrayToMatch(uow.outboxRepository.events, [
          {
            topic: "FTConnectedSuccessfully",
            payload: {
              ftConnectUserId: ftNotJobseekerUser.ftExternalId,
              conventionDraftId,
            },
          },
        ]);
        expectToEqual(response, {
          provider: "ftConnect",
          redirectUri: `http://baseUrl${frontRoutes.conventionImmersion({ conventionDraftId, skipIntro: true }).href}`,
        });
      });
    });

    describe("wrong paths", () => {
      it("rejects the connection if no state match the provided one in DB", async () => {
        proConnectOAuthGateway.setAccessTokenResponse({
          type: "ftConnect",
          expire: 60,
          payload: defaultExpectedIftConnectcIdTokenPayload,
          accessToken,
          idToken,
        });

        await expectPromiseToFailWithError(
          afterOAuthSuccessRedirection.execute({ code, state }),
          errors.auth.missingOAuth({ state }),
        );
        expectToEqual(uow.conventionDraftRepository.conventionDrafts, []);
      });

      it("should raise a Forbidden error if the nonce does not match", async () => {
        uow.ongoingOAuthRepository.ongoingOAuths = [
          {
            ...defaultFtOngoingOAuth,
            fromUri: "agencyDashboard",
            nonce: "existing-nonce",
          },
        ];
        ftConnectGateway.setAccessTokenResult({
          type: "ftConnect",
          expire: 60,
          payload: defaultExpectedIftConnectcIdTokenPayload,
          accessToken,
          idToken,
        });

        await expectPromiseToFailWithError(
          afterOAuthSuccessRedirection.execute({ code, state }),
          errors.auth.nonceMismatch(),
        );
        expectToEqual(uow.conventionDraftRepository.conventionDrafts, []);
      });

      it("should redirect with authFailure id on FtConnect auth failure", async () => {
        uow.ongoingOAuthRepository.ongoingOAuths = [defaultFtOngoingOAuth];
        ftConnectGateway.setAccessTokenResult({
          type: "ftConnect",
          expire: 60,
          payload: defaultExpectedIftConnectcIdTokenPayload,
          accessToken,
          idToken,
        });
        ftConnectGateway.setUser(undefined);

        const response = await afterOAuthSuccessRedirection.execute({
          code,
          state,
        });

        expectToEqual(uow.conventionDraftRepository.conventionDrafts, []);
        expectToEqual(response, {
          provider: "ftConnect",
          redirectUri: makeRouteAbsoluteUrl({
            route: frontRoutes.conventionImmersion({}),
            baseUrl: immersionFacileBaseUrl,
          }),
        });
      });
    });
  });

  describe("With provider 'email'", () => {
    describe("validate token", () => {
      const initialOngoingOAuth: OngoingOAuth = {
        fromUri: "/admin",
        provider: "email",
        state: "my-state",
        nonce: "nounce", // matches the one in the payload of the token
        email: "my-email@mail.com",
        usedAt: null,
      };

      beforeEach(() => {
        uow.ongoingOAuthRepository.ongoingOAuths = [{ ...initialOngoingOAuth }];
      });

      it("validate that token is from server", async () => {
        const userId = "userId";
        uuidGenerator.setNextUuid(userId);
        const result = await afterOAuthSuccessRedirection.execute({
          code: generateEmailAuthCode({ version: 1, emailAuthCode: true }),
          state: initialOngoingOAuth.state,
        });
        expectToEqual(result, {
          provider: "email",
          redirectUri: `http://fake-connected-user/admin?token=jwt-${userId}&provider=email`,
        });
      });

      it("throws if token is NOT from the server", async () => {
        const { privateKey: otherPrivateKey } = generateES256KeyPair();
        const verifyEmailAuthCode =
          makeVerifyJwtES256<"emailAuthCode">(otherPrivateKey);

        afterOAuthSuccessRedirection = makeAfterOAuthSuccess({
          uowPerformer: new InMemoryUowPerformer(uow),
          deps: {
            createNewEvent: makeCreateNewEvent({
              timeGateway: timeGateway,
              uuidGenerator,
            }),
            proConnectOAuthGateway: proConnectOAuthGateway,
            ftConnectGateway,
            uuidGenerator,
            generateConnectedUserLoginUrl: fakeGenerateConnectedUserUrlFn,
            verifyEmailAuthCodeJwt: verifyEmailAuthCode,
            immersionFacileBaseUrl,
            timeGateway,
          },
        });

        await expectPromiseToFailWithError(
          afterOAuthSuccessRedirection.execute({
            code: generateEmailAuthCode({ version: 1, emailAuthCode: true }),
            state: initialOngoingOAuth.state,
          }),
          errors.user.invalidJwt(),
        );
      });

      it("throws if token is outdated", async () => {
        const userId = "new-user-id";
        uuidGenerator.setNextUuid(userId);

        const expirationDate = subDays(timeGateway.now(), 1);

        await expectPromiseToFailWithError(
          afterOAuthSuccessRedirection.execute({
            code: generateEmailAuthCode({
              version: 1,
              exp: subDays(timeGateway.now(), 1).getTime() / 1000,
              emailAuthCode: true,
            }),
            state: initialOngoingOAuth.state,
          }),
          errors.user.expiredJwt(
            (timeGateway.now().getTime() - expirationDate.getTime()) /
              1000 /
              60,
          ),
        );
      });
    });

    describe("handle dynamic login pages", () => {
      it.each(
        keys(allowedLoginSources),
      )("generates an app token and returns a redirection url which includes token and user data for %s, create user and update onGoingOAuth", async (source) => {
        const email = "my-email@mail.com";

        const allowedRoute = allowedLoginSources[source];

        const initialOngoingOAuth: OngoingOAuth = {
          fromUri: allowedRoute().href,
          provider: "email",
          state: "my-state",
          nonce: "nounce", // matches the one in the payload of the token
          email,
          usedAt: null,
        };

        uow.ongoingOAuthRepository.ongoingOAuths = [initialOngoingOAuth];

        const userId = "new-user-id";
        uuidGenerator.setNextUuid(userId);

        const redirectedUrl = await afterOAuthSuccessRedirection.execute({
          code: generateEmailAuthCode({ version: 1, emailAuthCode: true }),
          state: initialOngoingOAuth.state,
        });

        expectToEqual(uow.userRepository.users, [
          {
            id: userId,
            email,
            createdAt: timeGateway.now().toISOString(),
            preventToDelete: false,
            firstName: "",
            lastName: "",
            proConnect: null,
            lastLoginAt: timeGateway.now().toISOString(),
          },
        ]);

        expectToEqual(uow.ongoingOAuthRepository.ongoingOAuths, [
          {
            ...initialOngoingOAuth,
            userId,
            usedAt: timeGateway.now(),
          },
        ]);

        expectToEqual(redirectedUrl, {
          provider: "email",
          redirectUri: `http://fake-connected-user${allowedRoute({ token: "jwt-new-user-id", provider: "email" }).href}`,
        });
      });
    });
  });

  describe("does not allow reuse of ongoing auth by redirecting to auth page with param alreadyUsedAuthentication true", () => {
    const redirectUrl = "/admin";

    it("email", async () => {
      const initialOngoingOAuth: OngoingOAuth = {
        fromUri: redirectUrl,
        provider: "email",
        state: "my-state",
        nonce: "nounce", // matches the one in the payload of the token
        email: "toto",
        usedAt: new Date(),
      };

      uow.ongoingOAuthRepository.ongoingOAuths = [initialOngoingOAuth];

      expectPromiseToFailWithError(
        afterOAuthSuccessRedirection.execute({
          code: "osef",
          state: initialOngoingOAuth.state,
        }),
        errors.auth.alreadyUsedAuthentication(),
      );
    });

    it("proConnect", async () => {
      const initialOngoingOAuth: OngoingOAuth = {
        fromUri: redirectUrl,
        provider: "proConnect",
        state: "my-state",
        nonce: "nounce", // matches the one in the payload of the token
        usedAt: new Date(),
        idToken: null,
      };

      uow.ongoingOAuthRepository.ongoingOAuths = [initialOngoingOAuth];

      const response = await afterOAuthSuccessRedirection.execute({
        code: "osef",
        state: initialOngoingOAuth.state,
      });

      expectToEqual(response, {
        redirectUri: `${immersionFacileBaseUrl}${redirectUrl}?alreadyUsedAuthentication=true`,
        provider: "proConnect",
      });

      expectToEqual(uow.ongoingOAuthRepository.ongoingOAuths, [
        initialOngoingOAuth,
      ]);
      expectToEqual(uow.userRepository.users, []);
    });
  });

  const makeSuccessfulAuthenticationConditions = (
    fromUri: string,
    params?: Partial<ProConnectGetAccessTokenPayload>,
  ) => {
    const expectedIcIdTokenPayload = {
      ...defaultExpectedProConnectIcIdTokenPayload,
      ...params,
    };
    const initialOngoingOAuth: OngoingOAuth = {
      fromUri,
      provider: "proConnect",
      state: "my-state",
      nonce: "nounce", // matches the one in the payload of the token
      usedAt: null,
      idToken: null,
    };
    uow.ongoingOAuthRepository.ongoingOAuths = [initialOngoingOAuth];

    const userId = "new-user-id";
    uuidGenerator.setNextUuid(userId);

    const accessToken = "access-token";
    const idToken: IdToken = "id-token";
    proConnectOAuthGateway.setAccessTokenResponse({
      type: "proConnect",
      payload: expectedIcIdTokenPayload,
      accessToken,
      expire: 60,
      idToken,
    });

    return {
      fromUri,
      accessToken,
      initialOngoingOAuth: { ...initialOngoingOAuth },
      userId,
      idToken,
    };
  };

  const addAlreadyExistingAuthenticatedUserInRepo = (
    options: { externalId?: string | null; preventToDelete?: boolean } = {},
  ) => {
    const alreadyExistingUser: UserWithAdminRights = {
      id: "already-existing-id",
      email: "johnny-d@gmail.com",
      firstName: "Johnny",
      lastName: "Doe Existing",
      proConnect:
        options.externalId !== null
          ? {
              externalId:
                options.externalId !== undefined
                  ? options.externalId
                  : defaultExpectedProConnectIcIdTokenPayload.sub,
              siret: defaultExpectedProConnectIcIdTokenPayload.siret,
            }
          : null,
      createdAt: new Date().toISOString(),
      preventToDelete: options.preventToDelete ?? false,
    };
    uow.userRepository.users = [alreadyExistingUser];
    return { alreadyExistingUser };
  };
});
