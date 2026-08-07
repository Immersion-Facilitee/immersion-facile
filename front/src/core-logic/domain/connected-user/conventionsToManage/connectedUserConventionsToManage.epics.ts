import { filter, map, switchMap } from "rxjs";
import { connectedUserConventionsToManageSlice } from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

type ConnectedUserConventionsToManageAction = ActionOfSlice<
  typeof connectedUserConventionsToManageSlice
>;
type ConnectedUserConventionsToManageEpic =
  AppEpic<ConnectedUserConventionsToManageAction>;

const getConventionsForConnectedUserEpic: ConnectedUserConventionsToManageEpic =
  (actions$, _, { conventionGateway }) =>
    actions$.pipe(
      filter(
        connectedUserConventionsToManageSlice.actions
          .getConventionsForConnectedUserRequested.match,
      ),
      switchMap((action) =>
        conventionGateway
          .getConventionsForUser$(action.payload.params, action.payload.jwt)
          .pipe(
            map((response) =>
              connectedUserConventionsToManageSlice.actions.getConventionsForConnectedUserSucceeded(
                {
                  feedbackTopic: action.payload.feedbackTopic,
                  data: response.data,
                  pagination: response.pagination,
                },
              ),
            ),
            catchEpicError((error) =>
              connectedUserConventionsToManageSlice.actions.getConventionsForConnectedUserFailed(
                {
                  feedbackTopic: action.payload.feedbackTopic,
                  errorMessage: error.message,
                },
              ),
            ),
          ),
      ),
    );

const getConventionsWithUnfinalizedAssessmentEpic: ConnectedUserConventionsToManageEpic =
  (actions$, _, { conventionGateway }) =>
    actions$.pipe(
      filter(
        connectedUserConventionsToManageSlice.actions
          .getConventionsWithUnfinalizedAssessmentRequested.match,
      ),
      switchMap((action) =>
        conventionGateway
          .getConventionsWithUnfinalizedAssessment$(
            action.payload.filters,
            action.payload.jwt,
          )
          .pipe(
            map((response) =>
              connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentSucceeded(
                {
                  feedbackTopic: action.payload.feedbackTopic,
                  data: response.data,
                  pagination: response.pagination,
                },
              ),
            ),
            catchEpicError((error) =>
              connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentFailed(
                {
                  feedbackTopic: action.payload.feedbackTopic,
                  errorMessage: error.message,
                },
              ),
            ),
          ),
      ),
    );

export const connectedUserConventionsEpics = [
  getConventionsForConnectedUserEpic,
  getConventionsWithUnfinalizedAssessmentEpic,
];
