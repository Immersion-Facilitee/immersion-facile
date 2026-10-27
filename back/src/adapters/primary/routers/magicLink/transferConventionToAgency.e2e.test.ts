import jwt from "jsonwebtoken";
import {
  AgencyDtoBuilder,
  authRoutes,
  ConnectedUserBuilder,
  ConventionDtoBuilder,
  conventionMagicLinkRoutes,
  currentJwtVersions,
  expectHttpResponseToEqual,
  expectToEqual,
  frontRoutes,
} from "shared";
import { invalidTokenMessage } from "../../../../config/bootstrap/connectedUserAuthMiddleware";
import { toAgencyWithRights } from "../../../../utils/agency";
import {
  buildTestApp,
  type TestAppAndDeps,
} from "../../../../utils/buildTestApp";
import { createConventionMagicLinkPayload } from "../../../../utils/jwt";

describe("Transfer convention authentication", () => {
  const agency = new AgencyDtoBuilder().build();
  const targetAgency = new AgencyDtoBuilder()
    .withId("22222222-2222-4222-8222-222222222222")
    .build();
  const counsellor = new ConnectedUserBuilder().buildUser();
  const convention = new ConventionDtoBuilder()
    .withAgencyId(agency.id)
    .withStatus("READY_TO_SIGN")
    .build();
  const transferRequest = {
    conventionId: convention.id,
    agencyId: targetAgency.id,
    justification: "Transfer to another agency",
  };
  const conventionPayload = createConventionMagicLinkPayload({
    id: convention.id,
    role: "counsellor",
    email: counsellor.email,
    now: new Date(),
  });

  let testApp: TestAppAndDeps;

  beforeEach(async () => {
    testApp = await buildTestApp();
    testApp.gateways.timeGateway.defaultDate = new Date();
    testApp.inMemoryUow.conventionRepository.setConventions([convention]);
    testApp.inMemoryUow.userRepository.users = [counsellor];
    testApp.inMemoryUow.agencyRepository.agencies = [
      toAgencyWithRights(agency, {
        [counsellor.id]: { roles: ["counsellor"], isNotifiedByEmail: true },
      }),
      toAgencyWithRights(targetAgency),
    ];
  });

  it("rejects a login code issued to an unrelated email address", async () => {
    await testApp.request
      .post(authRoutes.initiateLoginByEmail.url)
      .send({
        email: "unrelated@example.com",
        redirectUri: frontRoutes.agencyDashboard().href,
      })
      .expect(200);

    const notification =
      testApp.inMemoryUow.notificationRepository.notifications[0];
    if (notification?.templatedContent.kind !== "LOGIN_BY_EMAIL_REQUESTED")
      throw new Error("Expected an email login notification");
    const code = new URL(
      notification.templatedContent.params.loginLink,
    ).searchParams.get("code");
    if (!code) throw new Error("Expected a login code");
    const eventsBeforeTransfer = [
      ...testApp.inMemoryUow.outboxRepository.events,
    ];

    const { body, status, headers } = await testApp.request
      .post(conventionMagicLinkRoutes.transferConventionToAgency.url)
      .set("Authorization", code)
      .send(transferRequest);

    expectHttpResponseToEqual(
      { body, status, headers },
      {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      },
    );
    expectToEqual(testApp.inMemoryUow.conventionRepository.conventions, [
      convention,
    ]);
    expectToEqual(
      testApp.inMemoryUow.outboxRepository.events,
      eventsBeforeTransfer,
    );
  });

  it.each([
    { ...conventionPayload, applicationId: undefined },
    { ...conventionPayload, applicationId: "" },
    { ...conventionPayload, role: undefined },
    { ...conventionPayload, role: "back-office" },
    { ...conventionPayload, role: "agency-viewer" },
    { ...conventionPayload, emailHash: undefined },
    { ...conventionPayload, emailHash: "" },
    { ...conventionPayload, emailAuthCode: true },
    { ...conventionPayload, userId: counsellor.id },
    { version: currentJwtVersions.connectedUser, userId: "" },
    { version: currentJwtVersions.convention },
  ])("rejects unsupported or incomplete signed claims: %j", async (payload) => {
    const token = jwt.sign(payload, testApp.appConfig.jwtPrivateKey, {
      algorithm: "ES256",
      ...("exp" in payload ? {} : { expiresIn: 60 }),
    });

    const { body, status, headers } = await testApp.request
      .post(conventionMagicLinkRoutes.transferConventionToAgency.url)
      .set("Authorization", token)
      .send(transferRequest);

    expectHttpResponseToEqual(
      { body, status, headers },
      {
        status: 401,
        body: { status: 401, message: invalidTokenMessage },
      },
    );
    expectToEqual(testApp.inMemoryUow.conventionRepository.conventions, [
      convention,
    ]);
    expectToEqual(testApp.inMemoryUow.outboxRepository.events, []);
  });

  it.each(["magic link", "connected user"])(
    "allows an authorized counsellor with a %s token",
    async (identity) => {
      const token =
        identity === "magic link"
          ? testApp.generateConventionJwt(conventionPayload)
          : testApp.generateConnectedUserJwt({
              userId: counsellor.id,
              version: currentJwtVersions.connectedUser,
            });

      await testApp.request
        .post(conventionMagicLinkRoutes.transferConventionToAgency.url)
        .set("Authorization", token)
        .send(transferRequest)
        .expect(200);

      expectToEqual(testApp.inMemoryUow.conventionRepository.conventions, [
        { ...convention, agencyId: targetAgency.id },
      ]);
      expectToEqual(
        testApp.inMemoryUow.outboxRepository.events.map(({ topic }) => topic),
        ["ConventionTransferredToAgency"],
      );
    },
  );
});
