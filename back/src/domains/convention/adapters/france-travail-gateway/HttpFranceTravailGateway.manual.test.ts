import MockAdapter from "axios-mock-adapter";
import type { RedisClientType } from "redis";
import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  type ConventionReadDto,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  makeEmptyLastReminders,
} from "shared";
import { createAxiosSharedClient } from "shared-routes/axios";
import {
  AppConfig,
  type FTAccessTokenConfig,
} from "../../../../config/bootstrap/appConfig";
import { makeConnectedRedisClient } from "../../../../config/bootstrap/cache";
import { createFtAxiosHttpClientForTest } from "../../../../config/helpers/createFtAxiosHttpClientForTest";
import { makeAxiosInstances } from "../../../../utils/axiosUtils";
import { makeRedisWithCache } from "../../../core/caching-gateway/adapters/makeRedisWithCache";
import type { WithCache } from "../../../core/caching-gateway/port/WithCache";
import { noRetries } from "../../../core/retry-strategy/ports/RetryStrategy";
import { isBroadcastSuccessResponse } from "../../ports/FranceTravailGateway";
import type { BroadcastPayload } from "../../use-cases/broadcast/broadcastConvention.dto";
import { toBroadcastConvention } from "../../use-cases/broadcast/toBroadcastConvention";
import { createFranceTravailRoutes } from "./FranceTravailRoutes";
import { HttpFranceTravailGateway } from "./HttpFranceTravailGateway";

const config = AppConfig.createFromEnv();

const fakeFtApiUrl = "https://fake-ft.fr";
const fakeFtEnterpriseUrl = "https://fake-ft-enterprise.fr";
const ftRoutesWithFakeUrls = createFranceTravailRoutes({
  ftApiUrl: fakeFtApiUrl,
  ftEnterpriseUrl: fakeFtEnterpriseUrl,
});

const broadcastParams = (): BroadcastPayload => {
  const agency = new AgencyDtoBuilder()
    .withKind("france-travail")
    .withCodeSafir("12345")
    .build();
  const convention = new ConventionDtoBuilder()
    .withBeneficiaryEmail("test@PE-TEST.FR")
    .withBeneficiaryBirthdate("1994-10-22")
    .withAgencyId(agency.id)
    .build();
  const conventionRead: ConventionReadDto = {
    ...convention,
    agencyName: agency.name,
    agencyDepartment: agency.address.departmentCode,
    agencyContactEmail: agency.contactEmail,
    agencyKind: agency.kind,
    agencySiret: agency.agencySiret,
    agencyValidationSteps: "validator-only",
    assessment: null,
    lastReminders: makeEmptyLastReminders(),
    isEstablishmentBanned: false,
  };
  return {
    convention: toBroadcastConvention(
      conventionRead,
      { ...agency, validatorEmails: ["email@email.com"] },
      null,
    ),
  };
};

describe("HttpFranceTravailGateway", () => {
  const franceTravailRoutes = createFranceTravailRoutes({
    ftApiUrl: config.ftApiUrl,
    ftEnterpriseUrl: config.ftEnterpriseUrl,
  });

  let redisClient: RedisClientType<any, any, any>;
  let withCache: WithCache;

  beforeAll(async () => {
    redisClient = await makeConnectedRedisClient(config);

    withCache = makeRedisWithCache({
      defaultCacheDurationInHours: 1,
      redisClient,
    });
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  describe("getAccessToken", () => {
    it("fails when client is not allowed", async () => {
      const httpFranceTravailGateway = new HttpFranceTravailGateway(
        createFtAxiosHttpClientForTest(config),
        withCache,
        config.ftApiUrl,
        {
          ...config.franceTravailAccessTokenConfig,
          clientSecret: "wrong-secret",
        },
        noRetries,
        franceTravailRoutes,
      );

      await expectPromiseToFailWithError(
        httpFranceTravailGateway.getAccessToken("api_referentielagencesv1"),
        new Error(
          "[FranceTravailGateway.getAccessToken] : Client authentication failed",
        ),
      );
    });

    it("fails when scope is not valid", async () => {
      const httpFranceTravailGateway = new HttpFranceTravailGateway(
        createFtAxiosHttpClientForTest(config),
        withCache,
        config.ftApiUrl,
        config.franceTravailAccessTokenConfig,
        noRetries,
        franceTravailRoutes,
      );
      await expectPromiseToFailWithError(
        httpFranceTravailGateway.getAccessToken("whatever"),
        new Error("[FranceTravailGateway.getAccessToken] : Invalid scope"),
      );
    });

    it("gets the token when all is good", async () => {
      const httpFranceTravailGateway = new HttpFranceTravailGateway(
        createFtAxiosHttpClientForTest(config),
        withCache,
        config.ftApiUrl,
        config.franceTravailAccessTokenConfig,
        noRetries,
        franceTravailRoutes,
      );
      const result = await httpFranceTravailGateway.getAccessToken(
        "api_referentielagencesv1",
      );
      expectToEqual(result, {
        access_token: expect.any(String),
        expires_in: expect.any(Number),
        scope: "api_referentielagencesv1",
        token_type: "Bearer",
      });
    });
  });

  it("broadcast convention to FT", async () => {
    const httpFranceTravailGateway = new HttpFranceTravailGateway(
      createFtAxiosHttpClientForTest(config),
      withCache,
      config.ftApiUrl,
      config.franceTravailAccessTokenConfig,
      noRetries,
      franceTravailRoutes,
    );

    const response = await httpFranceTravailGateway.notifyOnConventionUpdated(
      broadcastParams(),
    );

    if (!isBroadcastSuccessResponse(response))
      throw errors.generic.testError(
        `FT broadcast expected 200/201/204, got ${JSON.stringify(response)}`,
      );
  });

  it("maps axios timeout on broadcast to a 500 FranceTravailBroadcastResponse", async () => {
    const axiosInstance = makeAxiosInstances(0).axiosWithValidateStatus;
    const httpClient = createAxiosSharedClient(
      ftRoutesWithFakeUrls,
      axiosInstance,
      { skipResponseValidation: true },
    );
    const fakeAccessTokenConfig: FTAccessTokenConfig = {
      immersionFacileBaseUrl: "https://",
      ftApiUrl: fakeFtApiUrl,
      ftAuthCandidatUrl: "https://",
      ftEnterpriseUrl: fakeFtEnterpriseUrl,
      clientId: "",
      clientSecret: "",
    };
    const gateway = new HttpFranceTravailGateway(
      httpClient,
      withCache,
      fakeFtApiUrl,
      fakeAccessTokenConfig,
      noRetries,
      ftRoutesWithFakeUrls,
      false,
    );

    const mock = new MockAdapter(axiosInstance);
    mock
      .onPost(
        `${fakeFtEnterpriseUrl}/connexion/oauth2/access_token?realm=%2Fpartenaire`,
      )
      .reply(200, {
        access_token: "yolo",
        expires_in: 3600,
        scope: "test",
        token_type: "Bearer",
      })
      .onPost(ftRoutesWithFakeUrls.broadcastConvention.url)
      .timeout();

    const response = await gateway.notifyOnConventionUpdated(broadcastParams());

    if (isBroadcastSuccessResponse(response))
      throw errors.generic.testError(
        `Expected error response, got success status ${response.status}`,
      );

    expectToEqual(response.status, 500);
    expectToEqual(
      response.subscriberErrorFeedback.message,
      "timeout of 0ms exceeded",
    );
    expect(response.subscriberErrorFeedback.error).toBeDefined();
  });

  it("maps an unexpected HTTP status on broadcast to subscriberErrorFeedback", async () => {
    const axiosInstance = makeAxiosInstances(
      config.externalAxiosTimeout,
    ).axiosWithValidateStatus;
    const httpClient = createAxiosSharedClient(
      ftRoutesWithFakeUrls,
      axiosInstance,
      { skipResponseValidation: true },
    );
    const fakeAccessTokenConfig: FTAccessTokenConfig = {
      immersionFacileBaseUrl: "https://",
      ftApiUrl: fakeFtApiUrl,
      ftAuthCandidatUrl: "https://",
      ftEnterpriseUrl: fakeFtEnterpriseUrl,
      clientId: "",
      clientSecret: "",
    };
    const gateway = new HttpFranceTravailGateway(
      httpClient,
      withCache,
      fakeFtApiUrl,
      fakeAccessTokenConfig,
      noRetries,
      ftRoutesWithFakeUrls,
      false,
    );

    const mock = new MockAdapter(axiosInstance);
    const unexpectedBody = { message: "yolo" };
    mock
      .onPost(
        `${fakeFtEnterpriseUrl}/connexion/oauth2/access_token?realm=%2Fpartenaire`,
      )
      .reply(200, {
        access_token: "yolo",
        expires_in: 3600,
        scope: "test",
        token_type: "Bearer",
      })
      .onPost(ftRoutesWithFakeUrls.broadcastConvention.url)
      .reply(502, unexpectedBody);

    const response = await gateway.notifyOnConventionUpdated(broadcastParams());

    if (isBroadcastSuccessResponse(response))
      throw errors.generic.testError(
        `PE broadcast OK must not occur, response status was : ${response.status}`,
      );

    expectToEqual(response.status, 502);
    expectToEqual(
      response.subscriberErrorFeedback.message,
      JSON.stringify(unexpectedBody, null, 2),
    );
  });
});
