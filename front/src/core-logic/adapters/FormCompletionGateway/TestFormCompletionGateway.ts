import { BehaviorSubject, delay, type Observable, of, Subject } from "rxjs";
import type {
  AppellationAndRomeDto,
  AppellationSearchInputParams,
  GetSiretEstablishmentDtoResponse,
  RomeDto,
} from "shared";
import type { FormCompletionGateway } from "src/core-logic/ports/FormCompletionGateway";

export class TestFormCompletionGateway implements FormCompletionGateway {
  public getSiretEstablishmentDtoResponseCallCount = 0;

  public isSiretInDb$ = new Subject<boolean>();

  public getSiretEstablishmentDto$ =
    new Subject<GetSiretEstablishmentDtoResponse>();

  public appellationDtoMatching$ = new Subject<AppellationAndRomeDto[]>();

  readonly #romeDtos$: Subject<RomeDto[]>;

  constructor(
    private readonly simulatedLatency = 0,
    seedRomeDtos?: RomeDto[],
  ) {
    this.#romeDtos$ = seedRomeDtos
      ? new BehaviorSubject(seedRomeDtos)
      : new Subject<RomeDto[]>();
  }

  public getAppellationDtoMatching$(
    _params: AppellationSearchInputParams,
  ): Observable<AppellationAndRomeDto[]> {
    return this.appellationDtoMatching$;
  }

  public getRomeDtoMatching(searchText: string): Observable<RomeDto[]> {
    if (searchText === "givemeanemptylistplease") return of([]);
    if (searchText === "givemeanerrorplease")
      throw new Error("418 I'm a teapot");

    return this.simulatedLatency
      ? this.#romeDtos$.pipe(delay(this.simulatedLatency))
      : this.#romeDtos$;
  }

  public getSiretEstablishmentDtoResponse$(): Observable<GetSiretEstablishmentDtoResponse> {
    this.getSiretEstablishmentDtoResponseCallCount++;
    return this.getSiretEstablishmentDto$;
  }

  public isSiretAlreadySaved$(): Observable<boolean> {
    return this.isSiretInDb$;
  }

  public get romeDtos$() {
    return this.#romeDtos$;
  }
}

export const seedRomeDtos: RomeDto[] = [
  {
    romeCode: "C1504",
    romeLabel: "Transaction immobilière",
  },
  {
    romeCode: "D1102",
    romeLabel: "Boulangerie - viennoiserie",
  },
  {
    romeCode: "D1101",
    romeLabel: "Boucherie",
  },
  {
    romeCode: "D1105",
    romeLabel: "Poissonneriee",
  },
];
