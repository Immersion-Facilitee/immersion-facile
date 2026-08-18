import {
  AgencyDtoBuilder,
  ConventionDtoBuilder,
  expectHttpResponseToEqual,
  type UnauthenticatedConventionRoutes,
  unauthenticatedConventionRoutes,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import { AppConfigBuilder } from "../../../utils/AppConfigBuilder";
import {
  buildTestApp,
  type InMemoryGateways,
} from "../../../utils/buildTestApp";

describe("security e2e", () => {
  const ftAgency = new AgencyDtoBuilder().withKind("france-travail").build();

  const convention = new ConventionDtoBuilder()
    .withAgencyId(ftAgency.id)
    .withFederatedIdentity({ provider: "ftConnect", token: "some-id" })
    .build();

  let unauthenticatedRequest: HttpClient<UnauthenticatedConventionRoutes>;
  let gateways: InMemoryGateways;

  beforeEach(async () => {
    const testApp = await buildTestApp(new AppConfigBuilder().build());
    const request = testApp.request;

    ({ gateways } = testApp);

    unauthenticatedRequest = createSupertestSharedClient(
      unauthenticatedConventionRoutes,
      request,
    );

    gateways.timeGateway.defaultDate = new Date();
  });

  describe("check request body for HTML", () => {
    it("400 - should throw an error if a request (POST) body parameter contains HTML", async () => {
      const response = await unauthenticatedRequest.createConvention({
        body: {
          convention: {
            ...convention,
            businessName: "<script>alert('XSS')</script>",
          },
        },
      });

      expectHttpResponseToEqual(response, {
        body: {
          status: 400,
          message: "Invalid request body",
        },
        status: 400,
      });
    });

    it("200 - should not throw an error if a request (POST) body parameter does not contain HTML", async () => {
      const response = await unauthenticatedRequest.createConvention({
        body: {
          convention: {
            ...convention,
            businessName: "L'amie > caline !",
          },
        },
      });

      expectHttpResponseToEqual(response, {
        body: {
          id: convention.id,
        },
        status: 200,
      });
    });

    it("400 - should throw an error if a request (GET) query parameter contains HTML", async () => {
      const response = await unauthenticatedRequest.findSimilarConventions({
        queryParams: {
          beneficiaryBirthdate: "1990-01-01",
          beneficiaryLastName: "<script>alert('XSS')</script>",
          codeAppellation: "1234567890",
          dateStart: "2021-01-01",
          siret: "12345678901234",
        },
      });

      expectHttpResponseToEqual(response, {
        body: {
          status: 400,
          message: "Invalid request body",
        },
        status: 400,
      });
    });

    it("200 - should not throw an error if a request (GET) query parameter does not contain HTML", async () => {
      const response = await unauthenticatedRequest.findSimilarConventions({
        queryParams: {
          beneficiaryBirthdate: "1990-01-01",
          beneficiaryLastName: "Bon<<eau",
          codeAppellation: "11573",
          dateStart: "2021-01-01",
          siret: "12345678901234",
        },
      });

      expectHttpResponseToEqual(response, {
        body: {
          similarConventionIds: [],
        },
        status: 200,
      });
    });
  });
});
