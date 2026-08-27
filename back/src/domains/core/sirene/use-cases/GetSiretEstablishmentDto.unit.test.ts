import {
  type BanEstablishmentPayload,
  errors,
  expectPromiseToFailWithError,
  expectToEqual,
  type SiretEstablishmentDto,
} from "shared";
import { EstablishmentAggregateBuilder } from "../../../establishment/helpers/EstablishmentBuilders";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../unit-of-work/adapters/InMemoryUowPerformer";
import { InMemorySiretGateway } from "../adapters/InMemorySiretGateway";
import {
  type GetSiretEstablishmentDto,
  makeGetSiretEstablishmentDto,
} from "./GetSiretEstablishmentDto";

describe("GetSiretEstablishmentDto", () => {
  const validAndAlreadySavedEstablishment: SiretEstablishmentDto = {
    siret: "12345678901234",
    businessName: "MA P'TITE BOITE",
    businessAddress: "20 AVENUE DE SEGUR 75007 PARIS 7",
    isOpen: true,
    numberEmployeesRange: "3-5",
    nafDto: { code: "7112B", nomenclature: "Ref2" },
    isAlreadySaved: true,
  };

  let siretGateway: InMemorySiretGateway;
  let uow: InMemoryUnitOfWork;
  let getSiretEstablishmentDto: GetSiretEstablishmentDto;

  beforeEach(() => {
    siretGateway = new InMemorySiretGateway();
    uow = createInMemoryUow();
    getSiretEstablishmentDto = makeGetSiretEstablishmentDto({
      deps: { siretGateway },
      uowPerformer: new InMemoryUowPerformer(uow),
    });
  });

  describe("right paths", () => {
    it("return siret dto with not already saved when establishment doesn't exist in repo", async () => {
      const response = await getSiretEstablishmentDto.execute({
        siret: validAndAlreadySavedEstablishment.siret,
      });

      expectToEqual(response, {
        ...validAndAlreadySavedEstablishment,
        isAlreadySaved: false,
      });
    });

    it("return siret dto with already saved when establishment exist in repo", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        new EstablishmentAggregateBuilder()
          .withEstablishmentSiret(validAndAlreadySavedEstablishment.siret)
          .withUserRights([
            {
              role: "establishment-admin",
              status: "ACCEPTED",
              job: "",
              phone: "",
              userId: "osef",
              shouldReceiveDiscussionNotifications: true,
              isMainContactByPhone: false,
            },
          ])
          .build(),
      ];

      expectToEqual(
        await getSiretEstablishmentDto.execute({
          siret: validAndAlreadySavedEstablishment.siret,
        }),
        validAndAlreadySavedEstablishment,
      );
    });

    it("return null when establishment is closed from siret gateway", async () => {
      const closedEstablishment: SiretEstablishmentDto = {
        ...validAndAlreadySavedEstablishment,
        siret: "11111111111111",
        isOpen: false,
      };

      siretGateway.setSirenEstablishment(closedEstablishment);

      const response = await getSiretEstablishmentDto.execute({
        siret: closedEstablishment.siret,
      });

      expectToEqual(response, null);
    });

    it("return null where siret not found", async () => {
      const siret = "40440440440400";

      expectToEqual(await getSiretEstablishmentDto.execute({ siret }), null);
    });

    it("return siret dto with businessNameCustomized when saved establishment has businessNameCustomized", async () => {
      uow.establishmentAggregateRepository.establishmentAggregates = [
        new EstablishmentAggregateBuilder()
          .withEstablishmentSiret(validAndAlreadySavedEstablishment.siret)
          .withEstablishmentCustomizedName("Enseigne Test")
          .withUserRights([
            {
              role: "establishment-admin",
              status: "ACCEPTED",
              job: "",
              phone: "",
              userId: "osef",
              shouldReceiveDiscussionNotifications: true,
              isMainContactByPhone: false,
            },
          ])
          .build(),
      ];

      expectToEqual(
        await getSiretEstablishmentDto.execute({
          siret: validAndAlreadySavedEstablishment.siret,
        }),
        {
          ...validAndAlreadySavedEstablishment,
          businessNameCustomized: "Enseigne Test",
        },
      );
    });
  });

  describe("wrong paths", () => {
    it("throws unavailable Api error if it gets a 429 from API", async () => {
      siretGateway.setError({
        initialError: {
          message: "Request failed with status code 429",
          status: 429,
          data: "some error",
        },
      });
      await expectPromiseToFailWithError(
        getSiretEstablishmentDto.execute({ siret: "42942942942900" }),
        errors.siretApi.tooManyRequests({ serviceName: "Sirene API" }),
      );
    });

    it("throws when siret is banned", async () => {
      const banEstablishmentPayload: BanEstablishmentPayload = {
        siret: "12345678912345",
        establishmentBannishmentJustification: "Valid justification",
      };

      uow.bannedEstablishmentRepository.bannedEstablishments = [
        banEstablishmentPayload,
      ];

      await expectPromiseToFailWithError(
        getSiretEstablishmentDto.execute({
          siret: banEstablishmentPayload.siret,
        }),
        errors.establishment.bannedEstablishment({
          siret: banEstablishmentPayload.siret,
        }),
      );
    });
  });
});
