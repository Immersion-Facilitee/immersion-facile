import { type Observable, Subject } from "rxjs";
import type {
  GetVisitorSessionQueryParams,
  MaskedOtpRecipients,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
  VisitorOtpJwt,
} from "shared";
import type {
  OtpChallengeGateway,
  VisitorSessionResult,
} from "src/core-logic/ports/OtpChallengeGateway";

export class TestOtpChallengeGateway implements OtpChallengeGateway {
  public maskedOtpRecipientResponse$ = new Subject<MaskedOtpRecipients>();
  public requestOtpChallengeResponse$ = new Subject<void>();
  public verifyOtpChallengeResponse$ = new Subject<void>();
  public visitorSessionResponse$ = new Subject<VisitorSessionResult>();

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
  ): Observable<void> {
    return this.verifyOtpChallengeResponse$;
  }

  public getVisitorSession$(
    _params: GetVisitorSessionQueryParams,
  ): Observable<VisitorSessionResult> {
    return this.visitorSessionResponse$;
  }
}
