import {
  type BanEstablishmentPayload,
  displayRouteName,
  errors,
  expectHttpResponseToEqual,
  type FormCompletionRoutes,
  formCompletionRoutes,
} from "shared";
import type { HttpClient } from "shared-routes";
import { createSupertestSharedClient } from "shared-routes/supertest";
import { TEST_OPEN_ESTABLISHMENT_1 } from "../../../../domains/core/sirene/adapters/InMemorySiretGateway";
import type { InMemoryUnitOfWork } from "../../../../domains/core/unit-of-work/adapters/createInMemoryUow";
import { buildTestApp } from "../../../../utils/buildTestApp";

describe("formCompletion Routes", () => {
  let httpClient: HttpClient<FormCompletionRoutes>;
  let inMemoryUow: InMemoryUnitOfWork;

  beforeEach(async () => {
    const testApp = await buildTestApp();
    inMemoryUow = testApp.inMemoryUow;
    httpClient = createSupertestSharedClient(
      formCompletionRoutes,
      testApp.request,
    );
  });

  describe(`${displayRouteName(formCompletionRoutes.appellation)}`, () => {
    it("200 - forwards valid requests", async () => {
      const response = await httpClient.appellation({
        queryParams: { searchText: "trail" },
      });
      expectHttpResponseToEqual(response, {
        body: [
          {
            appellationCode: "20714",
            appellationLabel: "Vitrailliste",
            romeCode: "B1602",
            romeLabel: "Vitraillerie",
          },
        ],
        status: 200,
      });
    });

    it("200 - forwards valid requests with true as string", async () => {
      const response = await httpClient.appellation({
        queryParams: {
          searchText: "trail",
          fetchAppellationsFromNaturalLanguage: "true" as unknown as true,
        },
      });
      expectHttpResponseToEqual(response, {
        body: [
          {
            appellationCode: "20714",
            appellationLabel: "Vitrailliste",
            romeCode: "B1602",
            romeLabel: "Vitraillerie",
          },
        ],
        status: 200,
      });
    });
  });

  describe(`${displayRouteName(formCompletionRoutes.getSiretEstablishmentDto)}`, () => {
    it("200 - processes valid requests", async () => {
      const response = await httpClient.getSiretEstablishmentDto({
        urlParams: { siret: TEST_OPEN_ESTABLISHMENT_1.siret },
      });

      expectHttpResponseToEqual(response, {
        status: 200,
        body: {
          siret: "12345678901234",
          businessName: "MA P'TITE BOITE",
          businessAddress: "20 AVENUE DE SEGUR 75007 PARIS 7",
          nafDto: { code: "7112B", nomenclature: "Ref2" },
          numberEmployeesRange: "3-5",
          isOpen: true,
          isAlreadySaved: false,
        },
      });
    });

    it("400 - invalid request", async () => {
      const response = await httpClient.getSiretEstablishmentDto({
        urlParams: { siret: "not_a_valid_siret" },
      });
      expectHttpResponseToEqual(response, {
        status: 400,
        body: {
          status: 400,
          message:
            "Schema validation failed in usecase GetSiretEstablishmentDto for element with id not_a_valid_siret. See issues for details.",
          issues: ["siret : SIRET doit être composé de 14 chiffres"],
        },
      });
    });

    it("403 - siret already banned", async () => {
      const banEstablishmentPayload: BanEstablishmentPayload = {
        siret: "12345678912345",
        establishmentBannishmentJustification:
          "Le cidre vendu n'est pas breton",
      };

      inMemoryUow.bannedEstablishmentRepository.bannedEstablishments = [
        banEstablishmentPayload,
      ];

      const response = await httpClient.getSiretEstablishmentDto({
        urlParams: { siret: banEstablishmentPayload.siret },
      });

      expectHttpResponseToEqual(response, {
        status: 403,
        body: {
          status: 403,
          message: `L'entreprise avec le siret '${banEstablishmentPayload.siret}' est bannie`,
        },
      });
    });

    it("404 - unknown siret", async () => {
      const siret = "40400000000404";
      const response = await httpClient.getSiretEstablishmentDto({
        urlParams: { siret },
      });
      expectHttpResponseToEqual(response, {
        status: 404,
        body: {
          status: 404,
          message: errors.siretApi.notFound({ siret }).message,
        },
      });
    });
  });
});
