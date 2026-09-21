import type { Observable } from "rxjs";
import { concatMap, filter, map, switchMap } from "rxjs";
import type { ConventionReadDto } from "shared";
import { isEstablishmentTutorIsEstablishmentRepresentative } from "shared";
import { assessmentSlice } from "src/core-logic/domain/assessment/assessment.slice";
import { sendAssessmentLinkSlice } from "src/core-logic/domain/assessment/send-assessment-link/sendAssessmentLink.slice";
import { conventionActionSlice } from "src/core-logic/domain/convention/convention-action/conventionAction.slice";
import { editConventionWithFinalStatusSlice } from "src/core-logic/domain/convention/edit-convention-with-final-status/editConventionWithFinalStatus.slice";
import { sendSignatureLinkSlice } from "src/core-logic/domain/convention/send-signature-link/sendSignatureLink.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import { conventionSlice } from "./convention.slice";

type ConventionAction = ActionOfSlice<typeof conventionSlice>;

type ConventionEpic = AppEpic<ConventionAction>;

const saveConventionEpic: ConventionEpic = (
  action$,
  state$,
  { conventionGateway },
) =>
  action$.pipe(
    filter(conventionSlice.actions.saveConventionRequested.match),
    switchMap((action) => {
      const conventionState = state$.value.convention;
      const { jwt } = conventionState;
      const conventionGatewayAction$ = jwt
        ? conventionGateway.updateConvention$(action.payload.convention, jwt)
        : conventionGateway.createConvention$(action.payload);

      return conventionGatewayAction$.pipe(
        map(() =>
          jwt
            ? conventionSlice.actions.updateConventionSucceeded({
                convention: action.payload.convention,
                discussionId: action.payload.discussionId,
                feedbackTopic: action.payload.feedbackTopic,
              })
            : conventionSlice.actions.createConventionSucceeded({
                convention: action.payload.convention,
                discussionId: action.payload.discussionId,
                feedbackTopic: action.payload.feedbackTopic,
              }),
        ),
        catchEpicError((error: Error) =>
          jwt
            ? conventionSlice.actions.updateConventionFailed({
                errorMessage: error.message,
                feedbackTopic: action.payload.feedbackTopic,
              })
            : conventionSlice.actions.createConventionFailed({
                errorMessage: error.message,
                feedbackTopic: action.payload.feedbackTopic,
              }),
        ),
      );
    }),
  );

const showSummaryChangedEpic: ConventionEpic = (action$) =>
  action$.pipe(
    filter(conventionSlice.actions.showSummaryChangeRequested.match),
    filter(
      (
        action,
      ): action is {
        type: string;
        payload: { showSummary: true; convention: ConventionReadDto };
      } => action.payload.showSummary,
    ),
    map((action) => {
      const { convention } = action.payload;
      return conventionSlice.actions.getSimilarConventionsRequested({
        codeAppellation: convention.immersionAppellation.appellationCode,
        siret: convention.siret,
        beneficiaryLastName: convention.signatories.beneficiary.lastName,
        dateStart: convention.dateStart,
        beneficiaryBirthdate: convention.signatories.beneficiary.birthdate,
        feedbackTopic: "convention-form",
      });
    }),
  );

const getSimilarConventionsEpic: ConventionEpic = (
  action$,
  _state$,
  { conventionGateway },
) =>
  action$.pipe(
    filter(conventionSlice.actions.getSimilarConventionsRequested.match),
    switchMap((action) =>
      conventionGateway.getSimilarConventions$(action.payload).pipe(
        map((similarConventionIds) =>
          conventionSlice.actions.getSimilarConventionsSucceeded({
            similarConventionIds,
            feedbackTopic: action.payload.feedbackTopic,
          }),
        ),
        catchEpicError((error: Error) =>
          conventionSlice.actions.getSimilarConventionsFailed({
            errorMessage: error.message,
            feedbackTopic: action.payload.feedbackTopic,
          }),
        ),
      ),
    ),
  );

const getConventionEpic: ConventionEpic = (
  action$,
  _state$,
  { conventionGateway },
) =>
  action$.pipe(
    filter(
      (action) =>
        conventionSlice.actions.fetchConventionRequested.match(action) ||
        conventionActionSlice.actions.signConventionSucceeded.match(action) ||
        conventionActionSlice.actions.acceptByCounsellorSucceeded.match(
          action,
        ) ||
        conventionActionSlice.actions.acceptByValidatorSucceeded.match(
          action,
        ) ||
        conventionActionSlice.actions.deprecateConventionSucceeded.match(
          action,
        ) ||
        conventionActionSlice.actions.rejectConventionSucceeded.match(action) ||
        conventionActionSlice.actions.cancelConventionSucceeded.match(action) ||
        conventionActionSlice.actions.transferConventionToAgencySucceeded.match(
          action,
        ) ||
        conventionActionSlice.actions.editCounsellorNameSucceeded.match(
          action,
        ) ||
        sendSignatureLinkSlice.actions.sendSignatureLinkSucceeded.match(
          action,
        ) ||
        sendAssessmentLinkSlice.actions.sendAssessmentLinkSucceeded.match(
          action,
        ) ||
        sendAssessmentLinkSlice.actions.sendAssessmentSignatureReminderSucceeded.match(
          action,
        ) ||
        assessmentSlice.actions.deleteAssessmentSucceeded.match(action) ||
        editConventionWithFinalStatusSlice.actions.editConventionWithFinalStatusSucceeded.match(
          action,
        ),
    ),
    switchMap((action): Observable<ConventionAction> => {
      if ("updateStatusParams" in action.payload) {
        return conventionGateway
          .retrieveFromToken$({
            conventionId: action.payload.updateStatusParams.conventionId,
            jwt: action.payload.jwt,
          })
          .pipe(
            map((convention) =>
              conventionSlice.actions.fetchConventionSucceeded({
                convention,
                feedbackTopic: action.payload.feedbackTopic,
              }),
            ),
          );
      }
      if (
        "transferConventionToAgencyParams" in action.payload ||
        "editCounsellorNameParams" in action.payload
      ) {
        return conventionGateway
          .retrieveFromToken$({
            conventionId:
              "transferConventionToAgencyParams" in action.payload
                ? action.payload.transferConventionToAgencyParams.conventionId
                : action.payload.editCounsellorNameParams.conventionId,
            jwt: action.payload.jwt,
          })
          .pipe(
            map((convention) =>
              conventionSlice.actions.fetchConventionSucceeded({
                convention,
                feedbackTopic: action.payload.feedbackTopic,
              }),
            ),
          );
      }
      return conventionGateway
        .retrieveFromToken$({
          conventionId: action.payload.conventionId,
          jwt: action.payload.jwt,
        })
        .pipe(
          map((convention) =>
            conventionSlice.actions.fetchConventionSucceeded({
              convention,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error: Error) =>
            conventionSlice.actions.fetchConventionFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        );
    }),
    filter((action): action is ConventionAction => action !== undefined),
  );

const reflectFetchedConventionOnFormUi: ConventionEpic = (action$, state$) =>
  action$.pipe(
    filter(conventionSlice.actions.fetchConventionSucceeded.match),
    concatMap((action) => [
      conventionSlice.actions.isTutorEstablishmentRepresentativeChanged(
        action.payload.convention
          ? isEstablishmentTutorIsEstablishmentRepresentative(
              action.payload.convention,
            )
          : state$.value.convention.formUi.isTutorEstablishmentRepresentative,
      ),
      conventionSlice.actions.isMinorChanged(
        action.payload.convention
          ? !!action.payload.convention.signatories.beneficiaryRepresentative
          : state$.value.convention.formUi.isMinor,
      ),
      conventionSlice.actions.isCurrentEmployerChanged(
        action.payload.convention
          ? !!action.payload.convention.signatories.beneficiaryCurrentEmployer
          : state$.value.convention.formUi.hasCurrentEmployer,
      ),
    ]),
  );

const getConventionStatusDashboardUrl: ConventionEpic = (
  action$,
  _,
  { conventionGateway },
) =>
  action$.pipe(
    filter(conventionSlice.actions.conventionStatusDashboardRequested.match),
    switchMap((action) =>
      conventionGateway
        .getConventionStatusDashboardUrl$(
          action.payload.conventionId,
          action.payload.jwt,
        )
        .pipe(
          map(({ url }) =>
            conventionSlice.actions.conventionStatusDashboardSucceeded({
              url,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
          catchEpicError((error: Error) =>
            conventionSlice.actions.conventionStatusDashboardFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

export const conventionEpics = [
  saveConventionEpic,
  getConventionEpic,
  reflectFetchedConventionOnFormUi,
  getConventionStatusDashboardUrl,
  getSimilarConventionsEpic,
  showSummaryChangedEpic,
];
