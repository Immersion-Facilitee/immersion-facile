import { addMinutes } from "date-fns";
import { type Observable, of } from "rxjs";
import type {
  ActiveOtpSession,
  GetOtpSessionQueryParams,
  MaskedOtpRecipients,
  OtpJwt,
  RequestOtpChallengeDto,
  VerifyOtpChallengeDto,
} from "shared";
import type { OtpChallengeGateway } from "src/core-logic/ports/OtpChallengeGateway";

export class SimulatedOtpChallengeGateway implements OtpChallengeGateway {
  public getMaskedOtpRecipient$(_jwt: OtpJwt): Observable<MaskedOtpRecipients> {
    return of({
      maskedEmail: "j***@mail.com",
      maskedPhone: "+33 6 ** ** ** 78",
    });
  }

  public requestOtpChallenge$(
    _params: RequestOtpChallengeDto,
    _jwt: OtpJwt,
  ): Observable<void> {
    return of(undefined);
  }

  public verifyOtpChallenge$(
    _params: VerifyOtpChallengeDto,
    _jwt: OtpJwt,
  ): Observable<ActiveOtpSession> {
    return of({
      purpose: "manageConvention",
      conventionId: "add5c20e-6dd2-45af-affe-927358005251",
      role: "beneficiary",
      expiresAt: addMinutes(new Date(), 30).toISOString(),
    });
  }

  public getOtpSession$(
    params: GetOtpSessionQueryParams,
  ): Observable<ActiveOtpSession | null> {
    return of({
      ...params,
      role: "beneficiary",
      expiresAt: addMinutes(new Date(), 30).toISOString(),
    });
  }
}
