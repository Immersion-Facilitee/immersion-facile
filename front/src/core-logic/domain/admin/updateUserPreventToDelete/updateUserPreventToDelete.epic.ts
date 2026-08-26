import { filter, map, switchMap } from "rxjs";
import { getConnectedUserJwt } from "src/core-logic/domain/admin/admin.helpers";
import { updateUserPreventToDeleteSlice } from "src/core-logic/domain/admin/updateUserPreventToDelete/updateUserPreventToDelete.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

type UpdateUserPreventToDeleteAction = ActionOfSlice<
  typeof updateUserPreventToDeleteSlice
>;
type UpdateUserPreventToDeleteEpic = AppEpic<UpdateUserPreventToDeleteAction>;

const updateUserPreventToDeleteEpic: UpdateUserPreventToDeleteEpic = (
  action$,
  state$,
  { adminGateway },
) =>
  action$.pipe(
    filter(
      updateUserPreventToDeleteSlice.actions.updateUserPreventToDeleteRequested
        .match,
    ),
    switchMap((action) =>
      adminGateway
        .updateUserPreventToDelete$(
          {
            userId: action.payload.userId,
            preventToDelete: action.payload.preventToDelete,
          },
          getConnectedUserJwt(state$.value),
        )
        .pipe(
          map(() =>
            updateUserPreventToDeleteSlice.actions.updateUserPreventToDeleteSucceeded(
              action.payload,
            ),
          ),
          catchEpicError((error) =>
            updateUserPreventToDeleteSlice.actions.updateUserPreventToDeleteFailed(
              {
                errorMessage: error.message,
                feedbackTopic: action.payload.feedbackTopic,
              },
            ),
          ),
        ),
    ),
  );

export const updateUserPreventToDeleteEpics = [updateUserPreventToDeleteEpic];
