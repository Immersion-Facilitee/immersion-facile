import { addMinutes } from "date-fns";
import { type Observable, of } from "rxjs";
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

export class SimulatedOtpChallengeGateway implements OtpChallengeGateway {
  public getMaskedOtpRecipient$(
    _jwt: VisitorOtpJwt,
  ): Observable<MaskedOtpRecipients> {
    return of({
      maskedEmail: "j***@mail.com",
      maskedPhone: "+33 6 ** ** ** 78",
    });
  }

  public requestOtpChallenge$(
    _params: RequestOtpChallengeDto,
    _jwt: VisitorOtpJwt,
  ): Observable<void> {
    return of(undefined);
  }

  public verifyOtpChallenge$(
    _params: VerifyOtpChallengeDto,
    _jwt: VisitorOtpJwt,
  ): Observable<void> {
    return of(undefined);
  }

  public getVisitorSession$(
    params: GetVisitorSessionQueryParams,
  ): Observable<VisitorSessionResult> {
    return of<VisitorSessionResult>({
      activeSession: {
        ...params,
        role: "beneficiary",
        expiresAt: addMinutes(new Date(), 30).toISOString(),
      },
      needsOtp: false,
    });
  }
}
