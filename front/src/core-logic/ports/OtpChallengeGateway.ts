import type { Observable } from "rxjs";
import type {
  ActiveOtpSession,
  GetOtpSessionQueryParams,
  MaskedOtpRecipients,
  OtpJwt,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
} from "shared";

export interface OtpChallengeGateway {
  getMaskedOtpRecipient$(jwt: OtpJwt): Observable<MaskedOtpRecipients>;
  requestOtpChallenge$(
    params: RequestOtpChallengeDto,
    jwt: OtpJwt,
  ): Observable<void>;
  verifyOtpChallenge$(
    params: VerifyOtpChallengeDto,
    jwt: OtpJwt,
  ): Observable<ActiveOtpSession>;
  getVisitorSession$(
    params: GetOtpSessionQueryParams,
  ): Observable<ActiveOtpSession | null>;
}
