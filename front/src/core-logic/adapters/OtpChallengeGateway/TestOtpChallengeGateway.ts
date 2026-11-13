import { type Observable, Subject } from "rxjs";
import type {
  ActiveVisitorSession,
  GetVisitorSessionQueryParams,
  MaskedOtpRecipients,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
  VisitorOtpJwt,
} from "shared";
import type { OtpChallengeGateway } from "src/core-logic/ports/OtpChallengeGateway";

export class TestOtpChallengeGateway implements OtpChallengeGateway {
  public maskedOtpRecipientResponse$ = new Subject<MaskedOtpRecipients>();
  public requestOtpChallengeResponse$ = new Subject<void>();
  public verifyOtpChallengeResponse$ = new Subject<ActiveVisitorSession>();
  public visitorSessionResponse$ = new Subject<ActiveVisitorSession | null>();

  public getMaskedOtpRecipient$(
    _jwt: VisitorOtpJwt,
  ): Observable<MaskedOtpRecipients> {
    return this.maskedOtpRecipientResponse$;
  }

  public requestOtpChallenge$(
    _params: RequestOtpChallengeDto,
    _jwt: VisitorOtpJwt,
  ): Observable<void> {
    return this.requestOtpChallengeResponse$;
  }

  public verifyOtpChallenge$(
    _params: VerifyOtpChallengeDto,
    _jwt: VisitorOtpJwt,
  ): Observable<ActiveVisitorSession> {
    return this.verifyOtpChallengeResponse$;
  }

  public getVisitorSession$(
    _params: GetVisitorSessionQueryParams,
  ): Observable<ActiveVisitorSession | null> {
    return this.visitorSessionResponse$;
  }
}
