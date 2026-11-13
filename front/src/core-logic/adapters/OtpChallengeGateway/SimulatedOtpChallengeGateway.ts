import { addMinutes } from "date-fns";
import { type Observable, of } from "rxjs";
import type {
  ActiveVisitorSession,
  GetVisitorSessionQueryParams,
  MaskedOtpRecipients,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
  VisitorOtpJwt,
} from "shared";
import type { OtpChallengeGateway } from "src/core-logic/ports/OtpChallengeGateway";

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
  ): Observable<ActiveVisitorSession> {
    return of({
      purpose: "manageConvention",
      conventionId: "add5c20e-6dd2-45af-affe-927358005251",
      role: "beneficiary",
      expiresAt: addMinutes(new Date(), 30).toISOString(),
    });
  }

  public getVisitorSession$(
    params: GetVisitorSessionQueryParams,
  ): Observable<ActiveVisitorSession | null> {
    return of({
      ...params,
      role: "beneficiary",
      expiresAt: addMinutes(new Date(), 30).toISOString(),
    });
  }
}
