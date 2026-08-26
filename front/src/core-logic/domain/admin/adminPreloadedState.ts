import { connectedUsersAdminInitialState } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { dashboardInitialState } from "src/core-logic/domain/admin/dashboardUrls/dashboardUrls.slice";
import { fetchUserInitialState } from "src/core-logic/domain/admin/fetchUser/fetchUser.slice";
import { listUsersInitialState } from "src/core-logic/domain/admin/listUsers/listUsers.slice";
import { notificationsInitialState } from "src/core-logic/domain/admin/notifications/notificationsSlice";
import { updateUserPreventToDeleteInitialState } from "src/core-logic/domain/admin/updateUserPreventToDelete/updateUserPreventToDelete.slice";
import { fetchAgencyOptionsInitialState } from "src/core-logic/domain/agencies/fetch-agency-options/fetchAgencyOptions.slice";
import type { RootState } from "src/core-logic/storeConfig/store";
import { apiConsumerInitialState } from "../apiConsumer/apiConsumer.slice";

type AdminState = RootState["admin"];

export const adminPreloadedState = (
  state: Partial<AdminState>,
): AdminState => ({
  dashboardUrls: dashboardInitialState,
  notifications: notificationsInitialState,
  fetchAgencyOptions: fetchAgencyOptionsInitialState,
  connectedUsersAdmin: connectedUsersAdminInitialState,
  apiConsumer: apiConsumerInitialState,
  listUsers: listUsersInitialState,
  fetchUser: fetchUserInitialState,
  updateUserPreventToDelete: updateUserPreventToDeleteInitialState,
  ...state,
});
