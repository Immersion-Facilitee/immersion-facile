import { filter, map, switchMap } from "rxjs";
import { groupSlice } from "src/core-logic/domain/group/group.slice";
import { catchEpicError } from "src/core-logic/storeConfig/catchEpicError";
import type {
  ActionOfSlice,
  AppEpic,
} from "src/core-logic/storeConfig/redux.helpers";

type GroupAction = ActionOfSlice<typeof groupSlice>;

type GroupEpic = AppEpic<GroupAction>;

const getGroupEpic: GroupEpic = (action$, _state$, { searchGateway }) =>
  action$.pipe(
    filter(groupSlice.actions.getGroupRequested.match),
    switchMap((action) =>
      searchGateway.getGroupInfoBySlug$(action.payload.slug).pipe(
        map((payload) => groupSlice.actions.getGroupSucceeded(payload)),
        catchEpicError((error) =>
          groupSlice.actions.getGroupFailed({
            errorMessage: error.message,
            feedbackTopic: action.payload.feedbackTopic,
          }),
        ),
      ),
    ),
  );

export const groupEpics = [getGroupEpic];
