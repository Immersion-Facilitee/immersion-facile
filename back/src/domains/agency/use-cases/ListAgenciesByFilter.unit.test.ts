import {
  type AddressDto,
  AgencyDtoBuilder,
  activeAgencyStatuses,
  expectToEqual,
  maxAgencyOptionsPerRequest,
} from "shared";
import { toAgencyWithRights } from "../../../utils/agency";
import { createInMemoryUow } from "../../core/unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../core/unit-of-work/adapters/InMemoryUowPerformer";
import {
  type ListAgencyOptionsByFilter,
  makeListAgencyOptionsByFilter,
  toAgencyOption,
} from "./ListAgenciesByFilter";

describe("Query: List agencies by filter", () => {
  const parisAddress: AddressDto = {
    city: "Paris",
    departmentCode: "75",
    postcode: "75001",
    streetNumberAndAddress: "OSEF",
  };
  const cergyAddress: AddressDto = {
    city: "Cergy",
    departmentCode: "95",
    postcode: "95000",
    streetNumberAndAddress: "OSEF",
  };
  const uzercheAddress: AddressDto = {
    city: "Uzerche",
    departmentCode: "19",
    postcode: "19140",
    streetNumberAndAddress: "OSEF",
  };

  const otherAgencyInParis = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("0")
      .withName("Agence autre 0")
      .withKind("autre")
      .withAddress(parisAddress)
      .build(),
  );
  const cciAgency1InCergy = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("1")
      .withName("Agence CCI 1")
      .withKind("cci")
      .withAddress(cergyAddress)
      .build(),
  );
  const cciAgency2InParis = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("2")
      .withName("Agence CCI 2")
      .withAddress(parisAddress)
      .withKind("cci")
      .build(),
  );
  const peAgency1InParis = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("3")
      .withName("Agence PE 3")
      .withKind("pole-emploi")
      .withAddress(parisAddress)
      .build(),
  );
  const peAgency2InParis = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("4")
      .withName("Agence PE 4")
      .withKind("pole-emploi")
      .withAddress(parisAddress)
      .build(),
  );
  const otherAgencyWithRefersToInCergy = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withRefersToAgencyInfo({
        refersToAgencyId: peAgency2InParis.id,
        refersToAgencyName: peAgency2InParis.name,
        refersToAgencyContactEmail: peAgency2InParis.contactEmail,
      })
      .withId("5")
      .withName("Agence avec refersTo")
      .withAddress(cergyAddress)
      .build(),
  );
  const agencyWithSiret = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("6")
      .withName("Agence avec Siret")
      .withKind("autre")
      .withAddress(uzercheAddress)
      .withAgencySiret("11122233344455")
      .build(),
  );
  const agencyChambreAgriculture = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("7")
      .withName("Agence chambre d'agriculture")
      .withKind("chambre-agriculture")
      .build(),
  );
  const agencyCma = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("8")
      .withName("Agency CMA")
      .withKind("cma")
      .build(),
  );

  const closedAgency = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("9")
      .withName("Agence Fermée")
      .withKind("mission-locale")
      .withStatus("closed")
      .build(),
  );
  const inReviewAgency = toAgencyWithRights(
    new AgencyDtoBuilder()
      .withId("10")
      .withName("Agence en revue")
      .withKind("cci")
      .withStatus("needsReview")
      .build(),
  );

  const allAgencies = [
    otherAgencyInParis,
    cciAgency1InCergy,
    cciAgency2InParis,
    peAgency1InParis,
    peAgency2InParis,
    otherAgencyWithRefersToInCergy,
    agencyWithSiret,
    agencyChambreAgriculture,
    agencyCma,
    closedAgency,
    inReviewAgency,
  ];

  let uow: ReturnType<typeof createInMemoryUow>;
  let listAgencyOptionsByFilter: ListAgencyOptionsByFilter;

  beforeEach(() => {
    uow = createInMemoryUow();
    listAgencyOptionsByFilter = makeListAgencyOptionsByFilter({
      uowPerformer: new InMemoryUowPerformer(uow),
    });
    uow.agencyRepository.agencies = allAgencies;
  });

  describe("No filters", () => {
    it("List all agencies with active statuses", async () => {
      const result = await listAgencyOptionsByFilter.execute({}, undefined);
      expectToEqual(
        result,
        allAgencies
          .filter((agency) => activeAgencyStatuses.includes(agency.status))
          .map(toAgencyOption),
      );
    });

    it("returns all agencies when no limit is provided", async () => {
      const uow = createInMemoryUow();
      listAgencyOptionsByFilter = makeListAgencyOptionsByFilter({
        uowPerformer: new InMemoryUowPerformer(uow),
      });
      const agencies = Array.from(
        { length: maxAgencyOptionsPerRequest + 1 },
        (_, index) =>
          toAgencyWithRights(
            new AgencyDtoBuilder()
              .withId(`agency-${index}`)
              .withName(`Agence ${index}`)
              .build(),
          ),
      );
      uow.agencyRepository.agencies = agencies;

      const result = await listAgencyOptionsByFilter.execute({}, undefined);

      expectToEqual(
        result,
        agencies.sort((a, b) => a.id.localeCompare(b.id)).map(toAgencyOption),
      );
    });

    it("uses requested limit when provided", async () => {
      const result = await listAgencyOptionsByFilter.execute(
        { limit: 2 },
        undefined,
      );
      expectToEqual(
        result,
        allAgencies
          .filter((agency) => activeAgencyStatuses.includes(agency.status))
          .slice(0, 2)
          .map(toAgencyOption),
      );
    });
  });

  describe("With Agency kind filter", () => {
    it("List miniStageOnly agencies", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { filterKind: "miniStageOnly" },
          undefined,
        ),
        [
          cciAgency1InCergy,
          cciAgency2InParis,
          agencyChambreAgriculture,
          agencyCma,
        ].map(toAgencyOption),
      );
    });

    it("List immersionPeOnly agencies", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { filterKind: "immersionPeOnly" },
          undefined,
        ),
        [peAgency1InParis, peAgency2InParis].map(toAgencyOption),
      );
    });

    it("List miniStageExcluded agencies", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { filterKind: "miniStageExcluded" },
          undefined,
        ),
        [
          otherAgencyInParis,
          peAgency1InParis,
          peAgency2InParis,
          otherAgencyWithRefersToInCergy,
          agencyWithSiret,
        ].map(toAgencyOption),
      );
    });

    it("List withoutRefersToAgency agencies", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { filterKind: "withoutRefersToAgency" },
          undefined,
        ),
        allAgencies
          .filter(
            (agency) =>
              agency.refersToAgencyId === null &&
              activeAgencyStatuses.includes(agency.status),
          )
          .map(toAgencyOption),
      );
    });

    it("List agencies for given siret", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { siret: "11122233344455" },
          undefined,
        ),
        [toAgencyOption(agencyWithSiret)],
      );
    });
  });

  describe("With Agency department code filter", () => {
    it("List agencies with department code 95", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { departmentCode: "95" },
          undefined,
        ),
        [cciAgency1InCergy, otherAgencyWithRefersToInCergy].map(toAgencyOption),
      );
    });

    it("List agencies with department code 75", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { departmentCode: "75" },
          undefined,
        ),
        [
          otherAgencyInParis,
          cciAgency2InParis,
          peAgency1InParis,
          peAgency2InParis,
        ].map(toAgencyOption),
      );
    });

    it("List agencies with department code 78", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { departmentCode: "78" },
          undefined,
        ),
        [].map(toAgencyOption),
      );
    });
  });

  describe("With Agency name", () => {
    it("List agencies with name 'PE'", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { nameIncludes: "PE" },
          undefined,
        ),
        [peAgency1InParis, peAgency2InParis].map(toAgencyOption),
      );
    });

    it("List agencies with name 'Agence'", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { nameIncludes: "Agence" },
          undefined,
        ),
        allAgencies
          .filter(
            (agency) =>
              agency.id !== agencyCma.id &&
              activeAgencyStatuses.includes(agency.status),
          )
          .map(toAgencyOption),
      );
    });

    it("List agencies by pasted agency uuid", async () => {
      const agencyUuid = "00000000-0000-0000-0000-000000000003";
      const agencyWithUuid = toAgencyWithRights(
        new AgencyDtoBuilder()
          .withId(agencyUuid)
          .withName("Name not matching UUID")
          .build(),
      );
      uow.agencyRepository.agencies = [agencyWithUuid];

      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { nameIncludes: agencyUuid },
          undefined,
        ),
        [agencyWithUuid].map(toAgencyOption),
      );
    });

    it("List agencies with name 'TOTO'", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { nameIncludes: "TOTO" },
          undefined,
        ),
        [].map(toAgencyOption),
      );
    });
  });

  describe("With Agency status filter", () => {
    it("List agencies with status 'closed'", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { status: ["closed"] },
          undefined,
        ),
        [closedAgency].map(toAgencyOption),
      );
    });

    it("List agencies with status 'toReview'", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          { status: ["needsReview"] },
          undefined,
        ),
        [inReviewAgency].map(toAgencyOption),
      );
    });

    it("List agencies with all the statuses", async () => {
      expectToEqual(
        await listAgencyOptionsByFilter.execute(
          {
            status: [
              "closed",
              "active",
              "from-api-PE",
              "needsReview",
              "rejected",
            ],
          },
          undefined,
        ),
        allAgencies
          .sort((a, b) => a.id.localeCompare(b.id))
          .map(toAgencyOption),
      );
    });
  });
});
