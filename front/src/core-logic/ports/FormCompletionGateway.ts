import type { Observable } from "rxjs";
import type {
  AppellationAndRomeDto,
  AppellationSearchInputParams,
  GetSiretInfo,
  SiretDto,
} from "shared";

export interface FormCompletionGateway {
  isSiretAlreadySaved$(siret: SiretDto): Observable<boolean>;
  getSiretInfo$(siret: SiretDto): Observable<GetSiretInfo>;
  getSiretInfoIfNotAlreadySaved$(siret: SiretDto): Observable<GetSiretInfo>;
  getAppellationDtoMatching$(
    params: AppellationSearchInputParams,
  ): Observable<AppellationAndRomeDto[]>;
}
