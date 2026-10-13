import { delay, type Observable, of, throwError } from "rxjs";
import type {
  AssessmentDto,
  ConventionId,
  ConventionSupportedJwt,
  DeleteAssessmentRequestDto,
  SendAssessmentLinkRequestDto,
  SignAssessmentRequestDto,
} from "shared";
import type { AssessmentGateway } from "src/core-logic/ports/AssessmentGateway";

export const failedId = "failed-id";
export const failedIdError = new Error("Failed Id");

export class SimulatedAssessmentGateway implements AssessmentGateway {
  constructor(private latency = 0) {}

  public signAssessment$(
    params: SignAssessmentRequestDto,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return params.conventionId === failedId
      ? throwError(failedIdError)
      : of(undefined).pipe(delay(this.latency));
  }

  public createAssessment$(
    assessment: AssessmentDto,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return assessment.conventionId === failedId
      ? throwError(failedIdError)
      : of(undefined).pipe(delay(this.latency));
  }

  public deleteAssessment$(
    params: DeleteAssessmentRequestDto,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return params.conventionId === failedId
      ? throwError(failedIdError)
      : of(undefined).pipe(delay(this.latency));
  }

  public getAssessment$({
    conventionId,
  }: {
    conventionId: ConventionId;
    jwt: string;
  }): Observable<AssessmentDto> {
    return of({
      conventionId,
      status: "COMPLETED",
      endedWithAJob: false,
      establishmentAdvices: "my advices",
      establishmentFeedback: "my feedback",
      beneficiaryAgreement: null,
      beneficiaryFeedback: null,
      signedAt: null,
      createdAt: new Date().toISOString(),
      createdBy: {
        role: "counsellor",
        email: "marie@agence.fr",
        firstName: "Marie",
        lastName: "Dupont",
      },
    });
  }

  public sendAssessmentLink$(
    _params: SendAssessmentLinkRequestDto,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return of(undefined).pipe(delay(this.latency));
  }

  public sendAssessmentSignatureReminder$(
    _params: SendAssessmentLinkRequestDto,
    _jwt: ConventionSupportedJwt,
  ): Observable<void> {
    return of(undefined).pipe(delay(this.latency));
  }
}
