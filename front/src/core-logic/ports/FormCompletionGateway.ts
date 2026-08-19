import type { Observable } from "rxjs";
import type {
  AppellationAndRomeDto,
  AppellationSearchInputParams,
  GetSiretEstablishmentDtoResponse,
  SiretDto,
} from "shared";

export interface FormCompletionGateway {
  isSiretAlreadySaved$(siret: SiretDto): Observable<boolean>;
  getSiretEstablishmentDtoResponse$(
    siret: SiretDto,
  ): Observable<GetSiretEstablishmentDtoResponse>;
  getAppellationDtoMatching$(
    params: AppellationSearchInputParams,
  ): Observable<AppellationAndRomeDto[]>;
}
