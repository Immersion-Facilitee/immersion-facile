import { createSelector } from "@reduxjs/toolkit";
import { getConventionManageAllowedRoles } from "shared";
import { conventionSelectors } from "src/core-logic/domain/convention/convention.selectors";
import { createRootSelector } from "src/core-logic/storeConfig/store";

const connectedUserState = createRootSelector((state) => state.connectedUser);

const isLoading = createSelector(
  connectedUserState,
  (state) => state.isLoading,
);

const currentUser = createSelector(
  connectedUserState,
  (state) => state.currentUser,
);

const userRolesForFetchedConvention = createSelector(
  currentUser,
  conventionSelectors.initialFetchedConvention,
  (icUser, convention) =>
    convention && icUser
      ? getConventionManageAllowedRoles(convention, icUser)
      : [],
);

export const connectedUserSelectors = {
  isLoading,
  currentUser,
  userRolesForFetchedConvention,
};
