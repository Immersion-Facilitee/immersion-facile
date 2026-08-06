import { expectToEqual } from "shared";
import {
  createInMemoryUow,
  type InMemoryUnitOfWork,
} from "../../unit-of-work/adapters/createInMemoryUow";
import { InMemoryUowPerformer } from "../../unit-of-work/adapters/InMemoryUowPerformer";
import { InMemoryAppellationsGateway } from "../adapters/InMemoryAppellationsGateway";
import {
  type AppellationSearch,
  makeAppellationSearch,
} from "./AppellationSearch";

describe("AppellationSearch", () => {
  let uow: InMemoryUnitOfWork;
  let appellationsGateway: InMemoryAppellationsGateway;
  let appellationSearch: AppellationSearch;

  beforeEach(() => {
    uow = createInMemoryUow();
    appellationsGateway = new InMemoryAppellationsGateway();
    appellationSearch = makeAppellationSearch({
      uowPerformer: new InMemoryUowPerformer(uow),
      deps: {
        appellationsGateway,
      },
    });
  });

  it("returns the list of found matches with ranges", async () => {
    expectToEqual(
      await appellationSearch.execute({
        searchText: "lapins",
      }),
      [
        {
          appellationCode: "14704",
          appellationLabel: "Éleveur / Éleveuse de lapins angoras",
          romeCode: "A1409",
          romeLabel: "Élevage",
        },
      ],
    );
  });

  it("returns the list of found matches with ranges from minimum search characters", async () => {
    expectToEqual(
      await appellationSearch.execute({
        searchText: "lap",
      }),
      [
        {
          appellationCode: "14704",
          appellationLabel: "Éleveur / Éleveuse de lapins angoras",
          romeCode: "A1409",
          romeLabel: "Élevage",
        },
      ],
    );
  });

  it("issues no queries for short search texts", async () => {
    expectToEqual(
      await appellationSearch.execute({
        searchText: "l",
      }),
      [],
    );
  });

  it("returns empty list when no match is found", async () => {
    expectToEqual(
      await appellationSearch.execute({
        searchText: "unknown_search_term",
      }),
      [],
    );
  });
  describe("with natural language search", () => {
    it("returns the list of found matches with ranges", async () => {
      appellationsGateway.setNextSearchAppellationsResult([
        { appellationCode: "19364", appellationLabel: "Secrétaire" },
        {
          appellationCode: "19367",
          appellationLabel: "Secrétaire bureautique spécialisé / spécialisée",
        },
      ]);

      uow.romeRepository.appellations = [
        {
          romeCode: "M1607",
          appellationCode: "19364",
          appellationLabel: "Secrétaire",
          romeLabel: "Secrétariat",
        },
        {
          romeCode: "M1607",
          appellationCode: "19367",
          appellationLabel: "Secrétaire bureautique spécialisé / spécialisée",
          romeLabel: "Secrétariat",
        },
      ];

      expectToEqual(
        await appellationSearch.execute({
          searchText: "secret",
          fetchAppellationsFromNaturalLanguage: true,
        }),
        [
          {
            romeCode: "M1607",
            appellationCode: "19364",
            appellationLabel: "Secrétaire",
            romeLabel: "Secrétariat",
          },
          {
            romeCode: "M1607",
            appellationCode: "19367",
            appellationLabel: "Secrétaire bureautique spécialisé / spécialisée",
            romeLabel: "Secrétariat",
          },
        ],
      );
    });

    it("do not return results if missing on rome repo like ROME 4 results", async () => {
      appellationsGateway.setNextSearchAppellationsResult([
        { appellationCode: "19364", appellationLabel: "Secrétaire" },
        {
          appellationCode: "19367",
          appellationLabel: "Secrétaire bureautique spécialisé / spécialisée",
        },
      ]);

      uow.romeRepository.appellations = [
        {
          romeCode: "M1607",
          appellationCode: "19364",
          appellationLabel: "Secrétaire",
          romeLabel: "Secrétariat",
        },
      ];

      expectToEqual(
        await appellationSearch.execute({
          searchText: "secret",
          fetchAppellationsFromNaturalLanguage: true,
        }),
        [
          {
            romeCode: "M1607",
            appellationCode: "19364",
            appellationLabel: "Secrétaire",
            romeLabel: "Secrétariat",
          },
        ],
      );
    });

    it("returns empty array if no match", async () => {
      expectToEqual(
        await appellationSearch.execute({
          searchText: "unknown_search_term",
          fetchAppellationsFromNaturalLanguage: true,
        }),
        [],
      );
    });

    it("has a fallback when diagoriente appellations search returns empty array", async () => {
      expectToEqual(
        await appellationSearch.execute({
          searchText: "lapins",
          fetchAppellationsFromNaturalLanguage: true,
        }),
        [
          {
            appellationCode: "14704",
            appellationLabel: "Éleveur / Éleveuse de lapins angoras",
            romeCode: "A1409",
            romeLabel: "Élevage",
          },
        ],
      );
    });
  });
});
