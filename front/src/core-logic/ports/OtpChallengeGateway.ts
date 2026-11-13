import type { Observable } from "rxjs";
import type {
  ActiveVisitorSession,
  GetVisitorSessionQueryParams,
  MaskedOtpRecipients,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
  VisitorOtpJwt,
} from "shared";

export interface OtpChallengeGateway {
  getMaskedOtpRecipient$(jwt: VisitorOtpJwt): Observable<MaskedOtpRecipients>;
  requestOtpChallenge$(
    params: RequestOtpChallengeDto,
    jwt: VisitorOtpJwt,
  ): Observable<void>;
  verifyOtpChallenge$(
    params: VerifyOtpChallengeDto,
    jwt: VisitorOtpJwt,
  ): Observable<ActiveVisitorSession>;
  getVisitorSession$(
    params: GetVisitorSessionQueryParams,
  ): Observable<ActiveVisitorSession | null>;
}
