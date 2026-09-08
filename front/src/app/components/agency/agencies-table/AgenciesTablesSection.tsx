import { useDispatch } from "react-redux";
import {
  type AgencyRight,
  distinguishAgencyRights,
  domElementIds,
  type User,
  type UserParamsForAgency,
} from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { Feedback } from "../../feedback/Feedback";
import { AgencyRightsTable } from "./AgencyRightsTable";

export const AgenciesTablesSection = ({
  user,
  agencyRights,
}: {
  user: User;
  agencyRights: AgencyRight[];
}) => {
  const dispatch = useDispatch();

  const currentUser = useAppSelector(connectedUserSelectors.currentUser);

  if (!currentUser) return <p>Vous n'êtes pas connecté...</p>;

  if (!agencyRights.length)
    return <p>Cet utilisateur n'est lié à aucun organisme.</p>;

  const { activeAgencyRights } = distinguishAgencyRights(agencyRights);

  const onUserUpdateRequested =
    (feedbackTopic: FeedbackTopic) =>
    (userParamsForAgency: UserParamsForAgency) => {
      dispatch(
        updateUserOnAgencySlice.actions.updateUserAgencyRightRequested({
          ...userParamsForAgency,
          feedbackTopic,
        }),
      );
    };

  return (
    <>
      <Feedback topics={["user"]} closable />

      {activeAgencyRights.length > 0 && (
        <AgencyRightsTable
          mode="other-rights"
          agencyRights={activeAgencyRights}
          user={user}
          modalId={domElementIds.admin.agencyTab.editAgencyManageUserModal}
          onUserUpdateRequested={onUserUpdateRequested("user")}
        />
      )}
    </>
  );
};
