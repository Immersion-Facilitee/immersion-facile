import {
  allowedLoginSources,
  BadRequestError,
  expectArraysToMatch,
  expectPromiseToFailWithError,
  expectToEqual,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  immersionFacileNoReplyEmailSender,
  makeRouteAbsoluteUrl,
  type UserWithAdminRights,
} from "shared";
import { AppConfigBuilder } from "../../../../../utils/AppConfigBuilder";
import { fakeGenerateEmailAuthCodeUrlFn } from "../../../../../utils/jwtTestHelper";
import {
  type ExpectSavedNotificationsAndEvents,
  makeExpectSavedNotificationsAndEvents,
} from "../../../../../utils/makeExpectSavedNotificationAndEvent.helpers";
import { makeSaveNotificationAndRelatedEvent } from "../../../notifications/helpers/Notification";
import { CustomTimeGateway } from "../../../time-gateway/adapters/CustomTimeGateway";
import type { TimeGateway } from "../../../time-gateway/ports/TimeGateway";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../../unit-of-work/adapters/InMemoryUowPerformer";
import { TestUuidGenerator } from "../../../uuid-generator/adapters/UuidGeneratorImplementations";
import {
  type InitiateLoginByEmail,
  makeInitiateLoginByEmail,
} from "./InitiateLoginByEmail";

describe("InitiateLoginByEmail usecase", () => {
  const config = new AppConfigBuilder().withTestPresetPreviousKeys().build();

  let initiateLoginByEmail: InitiateLoginByEmail;
  let uow: InMemoryUnitOfWork;
  let timeGateway: TimeGateway;
  let uuidGenerator: TestUuidGenerator;
  let expectSavedNotificationsAndEvents: ExpectSavedNotificationsAndEvents;

  const redirectUri = allowedLoginSources.establishmentDashboardDiscussions({
    discussionId: "any-discussion-id",
  }).href;

  const user: UserWithAdminRights = {
    id: "user-id",
    firstName: "Bob",
    lastName: "L'éponge",
    email: "email@mail.com",
    createdAt: new Date().toISOString(),
    proConnect: null,
  };

  beforeEach(() => {
    uow = createInMemoryUow();
    timeGateway = new CustomTimeGateway();
    uuidGenerator = new TestUuidGenerator();

    expectSavedNotificationsAndEvents = makeExpectSavedNotificationsAndEvents(
      uow.notificationRepository,
      uow.outboxRepository,
    );
    initiateLoginByEmail = makeInitiateLoginByEmail({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        config,
        saveNotificationAndRelatedEvent: makeSaveNotificationAndRelatedEvent(
          uuidGenerator,
          timeGateway,
        ),
        timeGateway,
        uuidGenerator,
        generateEmailAuthCodeUrl: fakeGenerateEmailAuthCodeUrlFn,
      },
    });
  });

  it("throws an error if the redirect uri is not allowed (simple open redirect)", async () => {
    await expectPromiseToFailWithError(
      initiateLoginByEmail.execute({
        email: user.email,
        redirectUri: "@example.com",
      }),
      new BadRequestError(
        "Schema validation failed in usecase InitiateLoginByEmail. See issues for details.",
        ["redirectUri : redirectUri is not allowed"],
      ),
    );
  });
  it("throws an error if the redirect uri is not allowed (path containing open redirect)", async () => {
    await expectPromiseToFailWithError(
      initiateLoginByEmail.execute({
        email: user.email,
        redirectUri: "/establishment@example.com",
      }),
      new BadRequestError(
        "Schema validation failed in usecase InitiateLoginByEmail. See issues for details.",
        ["redirectUri : redirectUri is not allowed"],
      ),
    );
  });

  it("When user exist by email", async () => {
    const state = "state1";
    uuidGenerator.setNextUuids(["nonce1", state]);
    uow.userRepository.users = [user];

    await initiateLoginByEmail.execute({
      email: user.email,
      redirectUri,
    });

    expectToEqual(uow.ongoingOAuthRepository.ongoingOAuths, [
      {
        fromUri: redirectUri,
        provider: "email",
        userId: user.id,
        nonce: "nonce1",
        state,
        email: user.email,
        usedAt: null,
      },
    ]);

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "LOGIN_BY_EMAIL_REQUESTED",
          params: {
            validMinutes: config.emailAuthCodeJwtDurationInMinutes,
            loginLink: makeRouteAbsoluteUrl({
              route: frontRoutes.magicLinkInterstitial({
                code: "EmailAuthCodeJwt",
                state,
                email: user.email,
              }),
              baseUrl: "http://fake-connected-user",
            }),
            fullname: getFormattedFirstnameAndLastname({
              firstname: user.firstName,
              lastname: user.lastName,
            }),
          },
          recipients: [user.email],
          sender: immersionFacileNoReplyEmailSender,
        },
      ],
    });

    expectArraysToMatch(uow.outboxRepository.events, [
      { topic: "NotificationAdded", priority: 1 },
    ]);
  });

  it("When user does not exist by email", async () => {
    const state = "state1";

    uuidGenerator.setNextUuids(["nonce1", state]);
    uow.userRepository.users = [];

    await initiateLoginByEmail.execute({
      email: user.email,
      redirectUri,
    });

    expectToEqual(uow.ongoingOAuthRepository.ongoingOAuths, [
      {
        fromUri: redirectUri,
        provider: "email",
        nonce: "nonce1",
        state,
        email: user.email,
        usedAt: null,
      },
    ]);

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "LOGIN_BY_EMAIL_REQUESTED",
          params: {
            validMinutes: config.emailAuthCodeJwtDurationInMinutes,
            loginLink: makeRouteAbsoluteUrl({
              route: frontRoutes.magicLinkInterstitial({
                code: "EmailAuthCodeJwt",
                state,
                email: user.email,
              }),
              baseUrl: "http://fake-connected-user",
            }),
            fullname: "",
          },
          recipients: [user.email],
          sender: immersionFacileNoReplyEmailSender,
        },
      ],
    });
  });
  it("should pass with deep nested redirect url", async () => {
    const state = "state1";
    uuidGenerator.setNextUuids(["nonce1", state]);
    uow.userRepository.users = [user];

    await initiateLoginByEmail.execute({
      email: user.email,
      redirectUri:
        "/mon-compte/tableau-de-bord-agence/dashboard/etablissement/1234567890/discussions/1234567890",
    });

    expectSavedNotificationsAndEvents({
      emails: [
        {
          kind: "LOGIN_BY_EMAIL_REQUESTED",
          params: {
            validMinutes: config.emailAuthCodeJwtDurationInMinutes,
            loginLink: makeRouteAbsoluteUrl({
              route: frontRoutes.magicLinkInterstitial({
                code: "EmailAuthCodeJwt",
                state,
                email: user.email,
              }),
              baseUrl: "http://fake-connected-user",
            }),
            fullname: getFormattedFirstnameAndLastname({
              firstname: user.firstName,
              lastname: user.lastName,
            }),
          },
          recipients: [user.email],
          sender: immersionFacileNoReplyEmailSender,
        },
      ],
    });
  });
});
