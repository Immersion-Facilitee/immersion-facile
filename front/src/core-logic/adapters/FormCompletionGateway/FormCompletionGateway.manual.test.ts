import axios from "axios";
import { firstValueFrom } from "rxjs";
import {
  conflictErrorSiret,
  expectToEqual,
  formCompletionRoutes,
  type GetSiretInfoError,
  tooManySirenRequestsSiret,
} from "shared";
import { createAxiosSharedClient } from "shared-routes/axios";
import type { FormCompletionGateway } from "src/core-logic/ports/FormCompletionGateway";
import { HttpFormCompletionGateway } from "./HttpFormCompletionGateway";
import { SimulatedFormCompletionGateway } from "./SimulatedFormCompletionGateway";

describe("FormCompletionGateway manual tests", () => {
  const simulated = new SimulatedFormCompletionGateway(0, {
    "12345678901234": {
      businessAddress: "20 AVENUE DE SEGUR 75007 PARIS 7",
      businessName: "MA P'TITE BOITE",
      isOpen: true,
      nafDto: {
        code: "7112B",
        nomenclature: "Ref2",
      },
      siret: "12345678901234",
      numberEmployeesRange: "",
      isAlreadySaved: false,
    },
    [tooManySirenRequestsSiret]: {
      businessAddress: "",
      businessName: "",
      isOpen: false,
      siret: tooManySirenRequestsSiret,
      numberEmployeesRange: "1-2",
      isAlreadySaved: false,
    },
    [conflictErrorSiret]: {
      businessAddress: "",
      businessName: "",
      isOpen: false,
      siret: conflictErrorSiret,
      numberEmployeesRange: "3-5",
      isAlreadySaved: true,
    },
  });

  const axiosInstance = axios.create({ baseURL: "http://localhost:1234" });

  const http = new HttpFormCompletionGateway(
    createAxiosSharedClient(formCompletionRoutes, axiosInstance),
  );

  const siretGatewaysThroughBack: FormCompletionGateway[] = [simulated, http];

  siretGatewaysThroughBack.forEach((siretGatewayThroughBack) => {
    describe(`${siretGatewayThroughBack.constructor.name} - manual`, () => {
      it("isSiretAlreadyInSaved - returns false if establishment with siret is in DB", async () => {
        const isSaved = await firstValueFrom(
          siretGatewayThroughBack.isSiretAlreadySaved$("40400000000404"),
        );
        expect(isSaved).toBe(false);
      });

      it("gets siret when all is good", async () => {
        const response = await firstValueFrom(
          siretGatewayThroughBack.getSiretEstablishmentDtoResponse$(
            "12345678901234",
          ),
        );
        expectToEqual(response, {
          businessAddress: "20 AVENUE DE SEGUR 75007 PARIS 7",
          businessName: "MA P'TITE BOITE",
          isOpen: true,
          nafDto: {
            code: "7112B",
            nomenclature: "Ref2",
          },
          siret: "12345678901234",
          numberEmployeesRange: "10-19",
          isAlreadySaved: false,
        });
      });

      it("already exist siret", async () => {
        const response = await firstValueFrom(
          siretGatewayThroughBack.getSiretEstablishmentDtoResponse$(
            conflictErrorSiret,
          ),
        );
        expectToEqual(response, {
          businessAddress: "",
          businessName: "",
          isOpen: false,
          siret: conflictErrorSiret,
          numberEmployeesRange: "3-5",
          isAlreadySaved: true,
        });
      });

      describe("when there is expected errors", () => {
        it("Missing establishment on SIRENE API.", async () => {
          await expectGetSirenInfoError(
            "00000000000000",
            "Missing establishment on SIRENE API.",
          );
        });

        it("Too many requests", async () => {
          await expectGetSirenInfoError(
            tooManySirenRequestsSiret,
            "Too many requests on SIRENE API.",
          );
        });
      });

      const expectGetSirenInfoError = (
        siret: string,
        expectedInfoError: GetSiretInfoError,
      ) =>
        firstValueFrom(
          siretGatewayThroughBack.getSiretEstablishmentDtoResponse$(siret),
        ).then((result) => {
          expect(result).toBe(expectedInfoError);
        });
    });
  });
});
