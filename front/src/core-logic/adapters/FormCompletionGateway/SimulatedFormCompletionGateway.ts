import {
  BehaviorSubject,
  delay,
  from,
  type Observable,
  of,
  Subject,
} from "rxjs";
import {
  type AppellationAndRomeDto,
  type AppellationSearchInputParams,
  apiSirenNotAvailableSiret,
  apiSirenUnexpectedError,
  conflictErrorSiret,
  type GetSiretInfo,
  type RomeDto,
  type SiretDto,
  type SiretEstablishmentDto,
  siretApiMissingEstablishmentMessage,
  siretApiUnavailableSiretErrorMessage,
  siretApiUnexpectedErrorErrorMessage,
  siretSchema,
  sleep,
  tooManySirenRequestsSiret,
  tooManySirenRequestsSiretErrorMessage,
} from "shared";
import type { FormCompletionGateway } from "../../ports/FormCompletionGateway";

export class SimulatedFormCompletionGateway implements FormCompletionGateway {
  readonly #romeDtos$: Subject<RomeDto[]>;

  constructor(
    private readonly simulatedLatency = 0,
    public sireneEstablishments: {
      [siret: SiretDto]: SiretEstablishmentDto;
    } = {},
    seedRomeDtos?: RomeDto[],
  ) {
    this.#romeDtos$ = seedRomeDtos
      ? new BehaviorSubject(seedRomeDtos)
      : new Subject<RomeDto[]>();
  }

  public getAppellationDtoMatching$(
    params: AppellationSearchInputParams,
  ): Observable<AppellationAndRomeDto[]> {
    return from(this.#getAppellationDtoMatching(params));
  }

  async #getAppellationDtoMatching(
    params: AppellationSearchInputParams,
  ): Promise<AppellationAndRomeDto[]> {
    await sleep(700);
    if (params.searchText === "givemeanemptylistplease") return [];
    if (params.searchText === "givemeanerrorplease")
      throw new Error("418 I'm a teapot");
    return [
      {
        appellationLabel:
          "Agent(e) chargé(e) protection, sauvegarde patrimoine naturel",
        romeCode: "A1204",
        romeLabel: "Agent",
        appellationCode: "11204",
      },
      {
        romeCode: "A1111",
        appellationCode: "11111",
        romeLabel: "Boulangerie",
        appellationLabel: "Boulanger - boulangère",
      },
      {
        romeCode: "B2222",
        appellationCode: "22222",
        romeLabel: "Boucherie",
        appellationLabel: "Boucher - Bouchère",
      },
      {
        romeCode: "C3333",
        appellationCode: "33333",
        romeLabel: "Menuiserie",
        appellationLabel: "Menuisier - Menuisière",
      },
      {
        romeCode: "D4444",
        appellationCode: "44444",
        romeLabel: "Vente",
        appellationLabel: "Veudeuse - Veudeur",
      },
    ];
  }

  public getRomeDtoMatching(searchText: string): Observable<RomeDto[]> {
    if (searchText === "givemeanemptylistplease") return of([]);
    if (searchText === "givemeanerrorplease")
      throw new Error("418 I'm a teapot");

    return this.simulatedLatency
      ? this.#romeDtos$.pipe(delay(this.simulatedLatency))
      : this.#romeDtos$;
  }

  public getSiretInfo$(siret: SiretDto): Observable<GetSiretInfo> {
    const response$ = of(this.#simulatedResponse(siret));
    return this.simulatedLatency
      ? response$.pipe(delay(this.simulatedLatency))
      : response$;
  }

  public getSiretInfoIfNotAlreadySaved$(
    siret: SiretDto,
  ): Observable<GetSiretInfo> {
    return this.getSiretInfo$(siret);
  }

  public isSiretAlreadySaved$(siret: SiretDto): Observable<boolean> {
    const response = this.#simulatedResponse(siret);
    const response$ = of(
      response === "Establishment with this siret is already in our DB",
    );
    return this.simulatedLatency
      ? response$.pipe(delay(this.simulatedLatency))
      : response$;
  }

  // for test purpose
  public get romeDtos$() {
    return this.#romeDtos$;
  }

  #simulatedResponse(rawSiret: SiretDto): GetSiretInfo {
    const siret = siretSchema.parse(rawSiret);

    if (siret === tooManySirenRequestsSiret)
      return tooManySirenRequestsSiretErrorMessage;
    if (siret === apiSirenNotAvailableSiret)
      return siretApiUnavailableSiretErrorMessage;
    if (siret === conflictErrorSiret)
      return "Establishment with this siret is already in our DB";
    if (siret === apiSirenUnexpectedError)
      throw new Error(siretApiUnexpectedErrorErrorMessage);
    const establishment = this.sireneEstablishments[siret];
    return establishment || siretApiMissingEstablishmentMessage;
  }
}
