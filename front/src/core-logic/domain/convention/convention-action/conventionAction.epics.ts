import type { ActionCreatorWithPayload } from "@reduxjs/toolkit";
import { filter, type Observable } from "rxjs";
import { delay, map, switchMap } from "rxjs/operators";
import { isStringJson } from "shared";
import { getConnectedUserJwt } from "src/core-logic/domain/admin/admin.helpers";
import type {
  PayloadActionWithFeedbackTopicError,
  PayloadWithFeedbackTopic,
} from "src/core-logic/domain/feedback/feedback.slice";
import type { ConventionGateway } from "src/core-logic/ports/ConventionGateway";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";
import {
  conventionActionSlice,
  type StatusChangePayload,
} from "./conventionAction.slice";

const makeConventionStatusChangeEpic =
  ({
    requestAction,
    successAction,
    failedAction,
  }: {
    requestAction: ConventionStatusChangeAction;
    successAction: ConventionStatusChangeAction;
    failedAction: ConventionStatusChangeFailedAction;
  }): ConventionActionEpic =>
  (
    action$: Observable<ConventionAction>,
    _,
    { conventionGateway }: { conventionGateway: ConventionGateway },
  ) =>
    action$.pipe(
      filter(requestAction.match),
      switchMap(({ payload }) =>
        conventionGateway
          .updateConventionStatus$(payload.updateStatusParams, payload.jwt)
          .pipe(
            map(() => successAction(payload)),
            catchEpicError((error: Error) =>
              failedAction({
                errorMessage: error.message,
                feedbackTopic: payload.feedbackTopic,
              }),
            ),
          ),
      ),
    );

export type ConventionAction = ActionOfSlice<typeof conventionActionSlice>;

type ConventionActionEpic = AppEpic<ConventionAction>;

const transferConventionToAgencyEpic: ConventionActionEpic = (
  action$,
  _,
  { conventionGateway },
) =>
  action$.pipe(
    filter(
      conventionActionSlice.actions.transferConventionToAgencyRequested.match,
    ),
    switchMap((action) =>
      conventionGateway
        .transferConventionToAgency$(
          action.payload.transferConventionToAgencyParams,
          action.payload.jwt,
        )
        .pipe(
          map(() =>
            conventionActionSlice.actions.transferConventionToAgencySucceeded(
              action.payload,
            ),
          ),
          catchEpicError((error) =>
            conventionActionSlice.actions.transferConventionToAgencyFailed({
              errorMessage: error.message,
              feedbackTopic: action.payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

const editConventionCounsellorNameEpic: ConventionActionEpic = (
  action$,
  _,
  { conventionGateway },
) =>
  action$.pipe(
    filter(conventionActionSlice.actions.editCounsellorNameRequested.match),
    switchMap(({ payload }) =>
      conventionGateway
        .editConventionCounsellorName$(
          payload.editCounsellorNameParams,
          payload.jwt,
        )
        .pipe(
          map(() =>
            conventionActionSlice.actions.editCounsellorNameSucceeded(payload),
          ),
          catchEpicError((error: Error) =>
            conventionActionSlice.actions.editCounsellorNameFailed({
              errorMessage: error.message,
              feedbackTopic: payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

const renewConventionEpic: ConventionActionEpic = (
  action$,
  _,
  { conventionGateway },
) =>
  action$.pipe(
    filter(conventionActionSlice.actions.renewConventionRequested.match),
    switchMap(({ payload }) =>
      conventionGateway.renewConvention$(payload.params, payload.jwt).pipe(
        map(() =>
          conventionActionSlice.actions.renewConventionSucceeded(payload),
        ),
        catchEpicError((error: Error) =>
          conventionActionSlice.actions.renewConventionFailed({
            errorMessage: error.message,
            feedbackTopic: payload.feedbackTopic,
          }),
        ),
      ),
    ),
  );

const cancelConventionEpic = makeConventionStatusChangeEpic({
  requestAction: conventionActionSlice.actions.cancelConventionRequested,
  successAction: conventionActionSlice.actions.cancelConventionSucceeded,
  failedAction: conventionActionSlice.actions.cancelConventionFailed,
});

const deprecateConventionEpic = makeConventionStatusChangeEpic({
  requestAction: conventionActionSlice.actions.deprecateConventionRequested,
  successAction: conventionActionSlice.actions.deprecateConventionSucceeded,
  failedAction: conventionActionSlice.actions.deprecateConventionFailed,
});

const rejectConventionEpic = makeConventionStatusChangeEpic({
  requestAction: conventionActionSlice.actions.rejectConventionRequested,
  successAction: conventionActionSlice.actions.rejectConventionSucceeded,
  failedAction: conventionActionSlice.actions.rejectConventionFailed,
});

const acceptByValidatorEpic = makeConventionStatusChangeEpic({
  requestAction: conventionActionSlice.actions.acceptByValidatorRequested,
  successAction: conventionActionSlice.actions.acceptByValidatorSucceeded,
  failedAction: conventionActionSlice.actions.acceptByValidatorFailed,
});

const acceptByCounsellorEpic = makeConventionStatusChangeEpic({
  requestAction: conventionActionSlice.actions.acceptByCounsellorRequested,
  successAction: conventionActionSlice.actions.acceptByCounsellorSucceeded,
  failedAction: conventionActionSlice.actions.acceptByCounsellorFailed,
});

const minimumDelayBeforeItIsPossibleToBroadcastAgainMs = 10_000;

const broadcastConventionAgainEpic: ConventionActionEpic = (
  action$,
  state$,
  { conventionGateway, scheduler },
) =>
  action$.pipe(
    filter(
      conventionActionSlice.actions.broadcastConventionToPartnerRequested.match,
    ),
    switchMap(({ payload }) =>
      conventionGateway
        .broadcastConventionAgain$(
          { conventionId: payload.conventionId },
          getConnectedUserJwt(state$.value),
        )
        .pipe(
          delay(minimumDelayBeforeItIsPossibleToBroadcastAgainMs, scheduler),
          map(() =>
            conventionActionSlice.actions.broadcastConventionToPartnerSucceeded(
              {
                conventionId: payload.conventionId,
                feedbackTopic: payload.feedbackTopic,
              },
            ),
          ),
          catchEpicError((error: Error) =>
            conventionActionSlice.actions.broadcastConventionToPartnerFailed({
              errorMessage: isStringJson(error.message[0])
                ? JSON.parse(error.message).message
                : error.message,
              feedbackTopic: payload.feedbackTopic,
            }),
          ),
        ),
    ),
  );

const signConventionEpic: ConventionActionEpic = (
  action$,
  _,
  { conventionGateway },
) =>
  action$.pipe(
    filter(conventionActionSlice.actions.signConventionRequested.match),
    switchMap(({ payload }) =>
      conventionGateway.signConvention$(payload.conventionId, payload.jwt).pipe(
        map(() =>
          conventionActionSlice.actions.signConventionSucceeded(payload),
        ),
        catchEpicError((error: Error) =>
          conventionActionSlice.actions.signConventionFailed({
            feedbackTopic: payload.feedbackTopic,
            errorMessage: error.message,
          }),
        ),
      ),
    ),
  );

export const conventionActionEpics = [
  broadcastConventionAgainEpic,
  transferConventionToAgencyEpic,
  cancelConventionEpic,
  deprecateConventionEpic,
  rejectConventionEpic,
  acceptByValidatorEpic,
  acceptByCounsellorEpic,
  signConventionEpic,
  renewConventionEpic,
  editConventionCounsellorNameEpic,
];

type ConventionStatusChangeAction = ActionCreatorWithPayload<
  StatusChangePayload & PayloadWithFeedbackTopic,
  string
>;

type ConventionStatusChangeFailedAction = ActionCreatorWithPayload<
  PayloadActionWithFeedbackTopicError["payload"],
  string
>;
