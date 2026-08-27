import { createSelector } from "@reduxjs/toolkit";
import { values } from "ramda";
import type { User } from "shared";
import type { RootState } from "src/core-logic/storeConfig/store";

const connectedUsersAdminState = ({ admin }: RootState) =>
  admin.connectedUsersAdmin;

const selectedUser = createSelector(
  connectedUsersAdminState,
  ({ selectedUser }) => selectedUser,
);

const connectedUsersNeedingReviewSelector = createSelector(
  connectedUsersAdminState,
  ({ connectedUsersNeedingReview }) => connectedUsersNeedingReview,
);

const agencyUsers = createSelector(
  connectedUsersAdminState,
  ({ agencyUsers }) => agencyUsers,
);

const isUpdatingConnectedUserAgency = createSelector(
  connectedUsersAdminState,
  ({ isUpdatingConnectedUserAgency }) => isUpdatingConnectedUserAgency,
);

const isUpdatingUserPreventToDelete = createSelector(
  connectedUsersAdminState,
  ({ isUpdatingUserPreventToDelete }) => isUpdatingUserPreventToDelete,
);

const agenciesNeedingReviewForSelectedUser = createSelector(
  connectedUsersNeedingReviewSelector,
  selectedUser,
  (usersNeedingReview, selectedUser) => {
    if (!selectedUser) return [];
    const inclusionConnectedUser = usersNeedingReview[selectedUser.id];
    if (!inclusionConnectedUser) return [];
    return values(inclusionConnectedUser.agencyRights).filter(({ roles }) =>
      roles.includes("to-review"),
    );
  },
);

const connectedUsersNeedingReview = createSelector(
  connectedUsersNeedingReviewSelector,
  (normalizedUsers): User[] =>
    values(normalizedUsers)
      .filter((user) =>
        values(user.agencyRights).some((right) =>
          right.roles.includes("to-review"),
        ),
      )
      .map(
        ({
          agencyRights: _1,
          dashboards: _2,
          establishments: _3,
          isBackofficeAdmin: _4,
          ...user
        }) => user,
      ),
);

export const connectedUsersAdminSelectors = {
  connectedUsersNeedingReview,
  selectedUser,
  agenciesNeedingReviewForSelectedUser,
  feedback: createSelector(
    connectedUsersAdminState,
    ({ feedback }) => feedback,
  ),
  agencyUsers,
  isUpdatingConnectedUserAgency,
  isUpdatingUserPreventToDelete,
};
