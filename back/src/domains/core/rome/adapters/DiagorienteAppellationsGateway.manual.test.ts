import {
  type AppellationDto,
  expectObjectsToMatch,
  expectToEqual,
} from "shared";
import { createFetchSharedClient } from "shared-routes/fetch";
import { AppConfig } from "../../../../config/bootstrap/appConfig";
import { withNoCache } from "../../caching-gateway/adapters/withNoCache";
import {
  DiagorienteAppellationsGateway,
  requestMinTime,
} from "./DiagorienteAppellationsGateway";
import { diagorienteAppellationsRoutes } from "./DiagorienteAppellationsGateway.routes";

describe("DiagorienteAppellationsGateway", () => {
  const config = AppConfig.createFromEnv();
  let appellationsGateway: DiagorienteAppellationsGateway;

  beforeEach(() => {
    appellationsGateway = new DiagorienteAppellationsGateway(
      createFetchSharedClient(diagorienteAppellationsRoutes, fetch),
      {
        clientId: config.diagorienteApiClientId,
        clientSecret: config.diagorienteApiClientSecret,
      },
      withNoCache,
    );
  });

  describe("getAccessToken", () => {
    it("returns an access token with client ID and secret", async () => {
      const response = await appellationsGateway.getAccessToken();
      expect(response).toMatchObject({
        access_token: expect.any(String),
        expires_in: expect.any(Number),
        token_type: "Bearer",
      });
    });

    it("should retrieve stored token, not requesting another", async () => {
      const { access_token: originalToken } =
        await appellationsGateway.getAccessToken();
      const { access_token: newToken } =
        await appellationsGateway.getAccessToken();
      expectToEqual(originalToken, newToken);
    });
  });

  describe("searchAppellations", () => {
    it("fetches search corretly", async () => {
      const result = await appellationsGateway.searchAppellations("luthier");

      expect(result).toEqual([
        {
          appellationCode: "16229",
          appellationLabel: "Luthier / Luthière",
        },
        {
          appellationCode: "16231",
          appellationLabel: "Luthier / Luthière guitare",
        },
        {
          appellationCode: "16232",
          appellationLabel: "Luthier / Luthière vents",
        },
        {
          appellationCode: "16230",
          appellationLabel: "Luthier / Luthière du quatuor",
        },
        {
          appellationCode: "38279",
          appellationLabel: "Flûtiste",
        },
      ]);
    });

    const parallelCalls = 100;
    it.each<{ search: string; results: AppellationDto[] }>([
      {
        search: "faire du pain",
        results: [
          {
            appellationLabel: "Ouvrier boulanger / Ouvrière boulangère",
            appellationCode: "17407",
          },
          {
            appellationLabel: "Biscuitier / Biscuitière",
            appellationCode: "11529",
          },
          {
            appellationLabel: "Boulanger / Boulangère",
            appellationCode: "11573",
          },
          {
            appellationLabel: "Fourreur / Fourreuse",
            appellationCode: "15157",
          },
          {
            appellationLabel: "Chef de rayon boulangerie",
            appellationCode: "12278",
          },
        ],
      },
      {
        search: "ux design",
        results: [
          {
            appellationLabel: "UX - user experience designer",
            appellationCode: "126549",
          },
          {
            appellationLabel: "UI - user interface designer",
            appellationCode: "126550",
          },
          {
            appellationLabel: "Designer",
            appellationCode: "13991",
          },
          {
            appellationLabel: "Web designer",
            appellationCode: "20726",
          },
          {
            appellationLabel: "Designer / Designeuse ergonome",
            appellationCode: "13998",
          },
        ],
      },
      {
        search: "Secrétaire",
        results: [
          {
            appellationLabel: "Secrétaire",
            appellationCode: "19364",
          },
          {
            appellationLabel: "Secrétaire bureautique",
            appellationCode: "19368",
          },
          {
            appellationLabel: "Secrétaire généraliste",
            appellationCode: "19395",
          },
          {
            appellationLabel: "Secrétaire administratif / administrative",
            appellationCode: "19365",
          },
          {
            appellationLabel: "Secrétaire juridique",
            appellationCode: "19396",
          },
        ],
      },
      {
        search: "Data analyst",
        results: [
          {
            appellationCode: "38971",
            appellationLabel: "Data analyst",
          },
          {
            appellationCode: "38972",
            appellationLabel: "Data scientist",
          },
          {
            appellationCode: "38975",
            appellationLabel: "Data manager",
          },
          {
            appellationCode: "38970",
            appellationLabel: "Data miner",
          },
          {
            appellationCode: "15565",
            appellationLabel: "Informaticien / Informaticienne analyste",
          },
        ],
      },
    ])(
      `returns matching results for ${parallelCalls} parralel query with term $search`,
      async ({ results, search }) => {
        await Promise.all(
          [...Array(parallelCalls)].map(async (_) => {
            expectObjectsToMatch(
              await appellationsGateway.searchAppellations(search),
              results,
            );
          }),
        );
      },
      parallelCalls * requestMinTime * 10 + 500,
    );

    it("fallsback to empty array when duration is over maximum", async () => {
      const maxDurationMs = 100;
      const appellationsGatewayWithLowMaxDuration =
        new DiagorienteAppellationsGateway(
          createFetchSharedClient(diagorienteAppellationsRoutes, fetch),
          {
            clientId: config.diagorienteApiClientId,
            clientSecret: config.diagorienteApiClientSecret,
          },
          withNoCache,
          maxDurationMs,
        );

      expectToEqual(
        await appellationsGatewayWithLowMaxDuration.searchAppellations(
          "design",
        ),
        [],
      );
    });

    it("fallsback to empty array when issue with access token", async () => {
      const appellationsGatewayWithBadClientSecret =
        new DiagorienteAppellationsGateway(
          createFetchSharedClient(diagorienteAppellationsRoutes, fetch),
          {
            clientId: config.diagorienteApiClientId,
            clientSecret: "BAD secret",
          },
          withNoCache,
        );

      expectToEqual(
        await appellationsGatewayWithBadClientSecret.searchAppellations(
          "design",
        ),
        [],
      );
    });
  });
});
