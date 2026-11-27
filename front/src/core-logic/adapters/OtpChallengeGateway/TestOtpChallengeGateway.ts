import { type Observable, Subject } from "rxjs";
import type {
  ActiveOtpSession,
  GetOtpSessionQueryParams,
  MaskedOtpRecipients,
  OtpJwt,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
} from "shared";
import type { OtpChallengeGateway } from "src/core-logic/ports/OtpChallengeGateway";

export class TestOtpChallengeGateway implements OtpChallengeGateway {
  public maskedOtpRecipientResponse$ = new Subject<MaskedOtpRecipients>();
  public requestOtpChallengeResponse$ = new Subject<void>();
  public verifyOtpChallengeResponse$ = new Subject<ActiveOtpSession>();
  public otpSessionResponse$ = new Subject<ActiveOtpSession | null>();

  public getMaskedOtpRecipient$(_jwt: OtpJwt): Observable<MaskedOtpRecipients> {
    return this.maskedOtpRecipientResponse$;
  }

  public requestOtpChallenge$(
    _params: RequestOtpChallengeDto,
    _jwt: OtpJwt,
  ): Observable<void> {
    return this.requestOtpChallengeResponse$;
  }

  public verifyOtpChallenge$(
    _params: VerifyOtpChallengeDto,
    _jwt: OtpJwt,
  ): Observable<ActiveOtpSession> {
    return this.verifyOtpChallengeResponse$;
  }

  public getOtpSession$(
    _params: GetOtpSessionQueryParams,
  ): Observable<ActiveOtpSession | null> {
    return this.otpSessionResponse$;
  }
}
