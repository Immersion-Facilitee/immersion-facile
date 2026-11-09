import {
  ConventionDtoBuilder,
  type ConventionId,
  type ConventionJwt,
  type ConventionMagicLinkRoutes,
  conventionMagicLinkRoutes,
  type Email,
  errors,
  expectHttpResponseToEqual,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import type { CustomTimeGateway } from "../../../../domains/core/time-gateway/adapters/CustomTimeGateway";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { buildTestApp } from "../../../../utils/buildTestApp";
import { createConventionMagicLinkPayload } from "../../../../utils/jwt";

describe("getConventionStatusDashboardUrl", () => {
  const conventionId: ConventionId = "my-Convention-id";
  const beneficiaryEmail: Email = "joe@lebenef.fr";

  let httpClient: HttpClient<ConventionMagicLinkRoutes>;
  let jwt: ConventionJwt;
  let uow: InMemoryUnitOfWork;
  let timeGateway: CustomTimeGateway;

  beforeEach(async () => {
    const { request, generateConventionJwt, inMemoryUow, gateways } =
      await buildTestApp();

    uow = inMemoryUow;

    timeGateway = gateways.timeGateway;
    timeGateway.setNextDate(new Date());

    jwt = generateConventionJwt(
      createConventionMagicLinkPayload({
        id: conventionId,
        role: "beneficiary",
        email: beneficiaryEmail,
        now: gateways.timeGateway.now(),
      }),
    );

    httpClient = createSupertestSharedClient(
      conventionMagicLinkRoutes,
      request,
    );
  });

  it("fails if neither magic link nor visitor session cookie is provided", async () => {
    const response = await httpClient.getConventionStatusDashboard({
      urlParams: { conventionId },
      headers: { authorization: "" },
    });

    expectHttpResponseToEqual(response, {
      status: 401,
      body: {
        status: 401,
        message: errors.visitorSession.unauthorized().message,
      },
    });
  });

  it("gets the dashboard url if token is correct", async () => {
    const convention = new ConventionDtoBuilder()
      .withId(conventionId)
      .withStatus("READY_TO_SIGN")
      .withBeneficiaryEmail(beneficiaryEmail)
      .build();

    uow.conventionRepository.setConventions([convention]);

    const response = await httpClient.getConventionStatusDashboard({
      urlParams: { conventionId },
      headers: { authorization: jwt },
    });

    expectHttpResponseToEqual(response, {
      status: 200,
      body: {
        url: `http://stubConventionStatusDashboard/${
          convention.id
        }/${timeGateway.now()}`,
        name: "conventionStatus",
      },
    });
  });
});
