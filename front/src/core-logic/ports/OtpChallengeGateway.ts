import type { Observable } from "rxjs";
import type {
  ActiveVisitorSession,
  GetVisitorSessionQueryParams,
  MaskedOtpRecipients,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
  VisitorOtpJwt,
} from "shared";

export type VisitorSessionResult =
  | { activeSession: ActiveVisitorSession; needsOtp: false }
  | { activeSession: null; needsOtp: true };

export interface OtpChallengeGateway {
  getMaskedOtpRecipient$(jwt: VisitorOtpJwt): Observable<MaskedOtpRecipients>;
  requestOtpChallenge$(
    params: RequestOtpChallengeDto,
    jwt: VisitorOtpJwt,
  ): Observable<void>;
  verifyOtpChallenge$(
    params: VerifyOtpChallengeDto,
    jwt: VisitorOtpJwt,
  ): Observable<void>;
  getVisitorSession$(
    params: GetVisitorSessionQueryParams,
  ): Observable<VisitorSessionResult>;
}
