import { combineReducers, configureStore } from "@reduxjs/toolkit";
import * as Sentry from "@sentry/browser";
import {
  combineEpics,
  createEpicMiddleware,
  type Epic,
} from "redux-observable";
import { catchError } from "rxjs";
import type { Dependencies } from "src/config/dependencies";
import { dashboardUrlsEpics } from "src/core-logic/domain/admin/dashboardUrls/dashboardUrls.epics";
import { dashboardUrlsSlice } from "src/core-logic/domain/admin/dashboardUrls/dashboardUrls.slice";
import { fetchUserEpics } from "src/core-logic/domain/admin/fetchUser/fetchUser.epic";
import { fetchUserSlice } from "src/core-logic/domain/admin/fetchUser/fetchUser.slice";
import { listUsersEpics } from "src/core-logic/domain/admin/listUsers/listUsers.epics";
import { listUsersSlice } from "src/core-logic/domain/admin/listUsers/listUsers.slice";
import { notificationsEpics } from "src/core-logic/domain/admin/notifications/notifications.epics";
import { notificationsSlice } from "src/core-logic/domain/admin/notifications/notificationsSlice";
import { closeAgencyAndTransfertConventionsEpics } from "src/core-logic/domain/agencies/close-agency-and-transfert-conventions/closeAgencyAndTransferConventions.epics";
import { closeAgencyAndTransferConventionsSlice } from "src/core-logic/domain/agencies/close-agency-and-transfert-conventions/closeAgencyAndTransferConventions.slice";
import { createUserOnAgencyEpics } from "src/core-logic/domain/agencies/create-user-on-agency/createUserOnAgency.epics";
import { createUserOnAgencySlice } from "src/core-logic/domain/agencies/create-user-on-agency/createUserOnAgency.slice";
import { fetchAgencyEpics } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.epics";
import { fetchAgencySlice } from "src/core-logic/domain/agencies/fetch-agency/fetchAgency.slice";
import { agenciesAdminEpics } from "src/core-logic/domain/agencies/fetch-agency-options/fetchAgencyOptions.epics";
import { fetchAgencyOptionsSlice } from "src/core-logic/domain/agencies/fetch-agency-options/fetchAgencyOptions.slice";
import { removeUserFromAgencyEpics } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.epics";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { updateAgencyEpics } from "src/core-logic/domain/agencies/update-agency/updateAgency.epics";
import { updateAgencySlice } from "src/core-logic/domain/agencies/update-agency/updateAgency.slice";
import { updateUserOnAgencyEpics } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.epic";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import { usersInReviewEpics } from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.epics";
import { usersToReviewSlice } from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.slice";
import { apiConsumerEpics } from "src/core-logic/domain/apiConsumer/apiConsumer.epics";
import { apiConsumerSlice } from "src/core-logic/domain/apiConsumer/apiConsumer.slice";
import { assessmentEpics } from "src/core-logic/domain/assessment/assessment.epics";
import { assessmentSlice } from "src/core-logic/domain/assessment/assessment.slice";
import { sendAssessmentLinkEpics } from "src/core-logic/domain/assessment/send-assessment-link/sendAssessmentLink.epics";
import { sendAssessmentLinkSlice } from "src/core-logic/domain/assessment/send-assessment-link/sendAssessmentLink.slice";
import { authSlice } from "src/core-logic/domain/auth/auth.slice";
import { connectedUserEpics } from "src/core-logic/domain/connected-user/connectedUser.epics";
import { connectedUserSlice } from "src/core-logic/domain/connected-user/connectedUser.slice";
import { connectedUserConventionListEpics } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.epics";
import { conventionListSlice } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import { connectedUserConventionsEpics } from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.epics";
import { connectedUserConventionsToManageSlice } from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.slice";
import { conventionsWithBroadcastFeedbackEpics } from "src/core-logic/domain/connected-user/conventionsWithBroadcastFeedback/conventionsWithBroadcastFeedback.epics";
import { conventionsWithBroadcastFeedbackSlice } from "src/core-logic/domain/connected-user/conventionsWithBroadcastFeedback/conventionsWithBroadcastFeedback.slice";
import { archivedConventionRequestEpics } from "src/core-logic/domain/convention/archivedConventionRequest.epics";
import { archivedConventionRequestSlice } from "src/core-logic/domain/convention/archivedConventionRequest.slice";
import { conventionActionEpics } from "src/core-logic/domain/convention/convention-action/conventionAction.epics";
import { conventionActionSlice } from "src/core-logic/domain/convention/convention-action/conventionAction.slice";
import { conventionDraftEpics } from "src/core-logic/domain/convention/convention-draft/conventionDraft.epics";
import { conventionDraftSlice } from "src/core-logic/domain/convention/convention-draft/conventionDraft.slice";
import { editConventionWithFinalStatusEpics } from "src/core-logic/domain/convention/edit-convention-with-final-status/editConventionWithFinalStatus.epic";
import { editConventionWithFinalStatusSlice } from "src/core-logic/domain/convention/edit-convention-with-final-status/editConventionWithFinalStatus.slice";
import { sendSignatureLinkEpics } from "src/core-logic/domain/convention/send-signature-link/sendSignatureLink.epic";
import { sendSignatureLinkSlice } from "src/core-logic/domain/convention/send-signature-link/sendSignatureLink.slice";
import { conventionTemplateEpics } from "src/core-logic/domain/convention-template/conventionTemplate.epics";
import { conventionTemplateSlice } from "src/core-logic/domain/convention-template/conventionTemplate.slice";
import { establishmentEpics } from "src/core-logic/domain/establishment/establishment.epics";
import { establishmentLeadEpics } from "src/core-logic/domain/establishmentLead/establishmentLead.epics";
import { establishmentLeadSlice } from "src/core-logic/domain/establishmentLead/establishmentLead.slice";
import { featureFlagEpics } from "src/core-logic/domain/featureFlags/featureFlags.epics";
import { featureFlagsSlice } from "src/core-logic/domain/featureFlags/featureFlags.slice";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import { nafEpics } from "src/core-logic/domain/naf/naf.epics";
import { nafSlice } from "src/core-logic/domain/naf/naf.slice";
import { rootAppEpics } from "src/core-logic/domain/rootApp/rootApp.epics";
import { rootAppSlice } from "src/core-logic/domain/rootApp/rootApp.slice";
import { searchEpics } from "src/core-logic/domain/search/search.epics";
import { searchSlice } from "src/core-logic/domain/search/search.slice";
import { siretEpics } from "src/core-logic/domain/siret/siret.epics";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";
import { connectedUsersAdminEpics } from "../domain/admin/connectedUsersAdmin/connectedUsersAdmin.epics";
import { connectedUsersAdminSlice } from "../domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { agenciesEpics } from "../domain/agencies/agencies.epics";
import { agenciesSlice } from "../domain/agencies/agencies.slice";
import { appellationEpics } from "../domain/appellation/appellation.epics";
import { appellationSlice } from "../domain/appellation/appellation.slice";
import { authEpics } from "../domain/auth/auth.epics";
import { conventionEpics } from "../domain/convention/convention.epics";
import { conventionSlice } from "../domain/convention/convention.slice";
import { discussionEpics } from "../domain/discussion/discussion.epics";
import { discussionSlice } from "../domain/discussion/discussion.slice";
import { establishmentSlice } from "../domain/establishment/establishment.slice";
import { establishmentBatchEpics } from "../domain/establishmentBatch/establishmentBatch.epics";
import { establishmentBatchSlice } from "../domain/establishmentBatch/establishmentBatch.slice";
import { geocodingEpics } from "../domain/geocoding/geocoding.epics";
import { geocodingSlice } from "../domain/geocoding/geocoding.slice";
import { geosearchEpics } from "../domain/geosearch/geosearch.epics";
import { geosearchSlice } from "../domain/geosearch/geosearch.slice";
import { partnersErroredConventionEpics } from "../domain/partnersErroredConvention/partnersErroredConvention.epics";
import { partnersErroredConventionSlice } from "../domain/partnersErroredConvention/partnersErroredConvention.slice";
import type { AppEpic } from "./redux.helpers";

const allEpics: AppEpic<any>[] = [
  ...agenciesAdminEpics,
  ...agenciesEpics,
  ...closeAgencyAndTransfertConventionsEpics,
  ...apiConsumerEpics,
  ...appellationEpics,
  ...assessmentEpics,
  ...authEpics,
  ...archivedConventionRequestEpics,
  ...conventionActionEpics,
  ...conventionDraftEpics,
  ...conventionEpics,
  ...conventionTemplateEpics,
  ...connectedUserConventionsEpics,
  ...connectedUserConventionListEpics,
  ...conventionsWithBroadcastFeedbackEpics,
  ...createUserOnAgencyEpics,
  ...dashboardUrlsEpics,
  ...discussionEpics,
  ...establishmentBatchEpics,
  ...establishmentEpics,
  ...establishmentLeadEpics,
  ...featureFlagEpics,
  ...fetchAgencyEpics,
  ...fetchUserEpics,
  ...geocodingEpics,
  ...geosearchEpics,
  ...connectedUsersAdminEpics,
  ...connectedUserEpics,
  ...listUsersEpics,
  ...nafEpics,
  ...notificationsEpics,
  ...partnersErroredConventionEpics,
  ...removeUserFromAgencyEpics,
  ...rootAppEpics,
  ...searchEpics,
  ...editConventionWithFinalStatusEpics,
  ...sendSignatureLinkEpics,
  ...sendAssessmentLinkEpics,
  ...siretEpics,
  ...updateAgencyEpics,
  ...updateUserOnAgencyEpics,
  ...usersInReviewEpics,
];

const appReducer = combineReducers({
  admin: combineReducers({
    [fetchAgencyOptionsSlice.name]: fetchAgencyOptionsSlice.reducer,
    [connectedUsersAdminSlice.name]: connectedUsersAdminSlice.reducer,
    [dashboardUrlsSlice.name]: dashboardUrlsSlice.reducer,
    [notificationsSlice.name]: notificationsSlice.reducer,
    [apiConsumerSlice.name]: apiConsumerSlice.reducer,
    [listUsersSlice.name]: listUsersSlice.reducer,
    [fetchUserSlice.name]: fetchUserSlice.reducer,
  }),
  agency: combineReducers({
    [closeAgencyAndTransferConventionsSlice.name]:
      closeAgencyAndTransferConventionsSlice.reducer,
    [updateUserOnAgencySlice.name]: updateUserOnAgencySlice.reducer,
    [fetchAgencySlice.name]: fetchAgencySlice.reducer,
    [updateAgencySlice.name]: updateAgencySlice.reducer,
    [createUserOnAgencySlice.name]: createUserOnAgencySlice.reducer,
    [removeUserFromAgencySlice.name]: removeUserFromAgencySlice.reducer,
  }),
  [fetchAgencyOptionsSlice.name]: fetchAgencyOptionsSlice.reducer,
  [agenciesSlice.name]: agenciesSlice.reducer,
  [appellationSlice.name]: appellationSlice.reducer,
  [assessmentSlice.name]: assessmentSlice.reducer,
  [authSlice.name]: authSlice.reducer,
  [archivedConventionRequestSlice.name]: archivedConventionRequestSlice.reducer,
  [conventionSlice.name]: conventionSlice.reducer,
  [conventionDraftSlice.name]: conventionDraftSlice.reducer,
  [conventionTemplateSlice.name]: conventionTemplateSlice.reducer,
  [discussionSlice.name]: discussionSlice.reducer,
  [establishmentBatchSlice.name]: establishmentBatchSlice.reducer,
  [establishmentLeadSlice.name]: establishmentLeadSlice.reducer,
  [establishmentSlice.name]: establishmentSlice.reducer,
  [featureFlagsSlice.name]: featureFlagsSlice.reducer,
  [geosearchSlice.name]: geosearchSlice.reducer,
  [geocodingSlice.name]: geocodingSlice.reducer,
  [connectedUserSlice.name]: connectedUserSlice.reducer,
  [connectedUserConventionsToManageSlice.name]:
    connectedUserConventionsToManageSlice.reducer,
  [conventionsWithBroadcastFeedbackSlice.name]:
    conventionsWithBroadcastFeedbackSlice.reducer,
  [conventionListSlice.name]: conventionListSlice.reducer,
  [feedbackSlice.name]: feedbackSlice.reducer,
  [partnersErroredConventionSlice.name]: partnersErroredConventionSlice.reducer,
  [editConventionWithFinalStatusSlice.name]:
    editConventionWithFinalStatusSlice.reducer,
  [sendSignatureLinkSlice.name]: sendSignatureLinkSlice.reducer,
  [sendAssessmentLinkSlice.name]: sendAssessmentLinkSlice.reducer,
  [searchSlice.name]: searchSlice.reducer,
  [siretSlice.name]: siretSlice.reducer,
  [nafSlice.name]: nafSlice.reducer,
  [conventionActionSlice.name]: conventionActionSlice.reducer,
  [usersToReviewSlice.name]: usersToReviewSlice.reducer,
});

const rootReducer: typeof appReducer = (state, action) =>
  appReducer(
    action.type === rootAppSlice.actions.appResetRequested.type
      ? undefined
      : state,
    action,
  );

const rootEpic: Epic = (action$, store$, dependencies) =>
  combineEpics(...allEpics)(action$, store$, dependencies).pipe(
    catchError((error, source) => {
      // biome-ignore lint/suspicious/noConsole: debug purpose
      console.error("combineEpic", error);
      Sentry.captureException(error);
      return source;
    }),
  );

type StoreProps = {
  dependencies: Dependencies;
  preloadedState?: Partial<RootState>;
};

export const createStore = ({ dependencies, preloadedState }: StoreProps) => {
  const epicMiddleware = createEpicMiddleware({ dependencies });
  const store = configureStore({
    preloadedState,
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => [
      ...getDefaultMiddleware({ thunk: false }),
      epicMiddleware,
    ],
  });
  epicMiddleware.run(rootEpic);
  return store;
};

export type RootState = ReturnType<typeof rootReducer>;
export const createRootSelector = <T>(selector: (state: RootState) => T) =>
  selector;

export type ReduxStore = ReturnType<typeof createStore>;
