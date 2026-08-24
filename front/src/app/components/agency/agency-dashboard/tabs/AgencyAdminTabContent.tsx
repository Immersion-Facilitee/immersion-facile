import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { useEffect, useMemo, useState } from "react";
import {
  HeadingSection,
  Loader,
  TaskSummary,
  useScrollTo,
} from "react-design-system";
import { useDispatch, useSelector } from "react-redux";
import type { UserParamsForAgency } from "shared";
import {
  type AgencyRight,
  type ConnectedUser,
  domElementIds,
  immersionFacileAgencyRegistrationHelpFormUrl,
} from "shared";
import { AgencyRightsTable } from "src/app/components/agency/agencies-table/AgencyRightsTable";
import { AgencyAdminUsersToReview } from "src/app/components/agency/agency-dashboard/AgencyAdminUsersToReview";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useFeedbackTopics } from "src/app/hooks/feedback.hooks";
import { updateUserOnAgencySlice } from "src/core-logic/domain/agencies/update-user-on-agency/updateUserOnAgency.slice";
import { usersToReviewSelectors } from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.selectors";
import { usersToReviewSlice } from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";

export const AgencyAdminTabContent = ({
  activeAgencyRights,
  currentUser,
}: {
  activeAgencyRights: AgencyRight[];
  currentUser: ConnectedUser;
}) => {
  const dispatch = useDispatch();

  const agenciesUserIsAdminOn = activeAgencyRights.filter((agencyRight) =>
    agencyRight.roles.includes("agency-admin"),
  );
  const agenciesUserIsNotAdminOn = activeAgencyRights.filter(
    (agencyRight) => !agencyRight.roles.includes("agency-admin"),
  );
  const usersToReview = useSelector(usersToReviewSelectors.usersToReview);
  const isLoadingUsersToReview = useSelector(usersToReviewSelectors.isLoading);
  const [hasRequestedUsersToReview, setHasRequestedUsersToReview] =
    useState(false);
  const agencyIdsUserIsAdminOn = useMemo(
    () =>
      activeAgencyRights
        .filter((agencyRight) => agencyRight.roles.includes("agency-admin"))
        .map((agencyRight) => agencyRight.agency.id),
    [activeAgencyRights],
  );

  useScrollTo(
    useFeedbackTopics(["agency-user-for-dashboard", "agency-users-to-review"])
      .length > 0,
  );

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

  useEffect(() => {
    if (agencyIdsUserIsAdminOn.length === 0) return;

    dispatch(
      usersToReviewSlice.actions.fetchUsersToReviewRequested({
        agencyRole: "to-review",
        agencyIds: agencyIdsUserIsAdminOn,
        feedbackTopic: "agency-users-to-review",
      }),
    );
  }, [dispatch, agencyIdsUserIsAdminOn]);

  if (hasRequestedUsersToReview) {
    return (
      <>
        <Button
          priority="secondary"
          iconId="fr-icon-arrow-left-line"
          className={fr.cx("fr-mb-3w")}
          onClick={() => {
            setHasRequestedUsersToReview(false);
          }}
        >
          Retour
        </Button>
        <AgencyAdminUsersToReview usersToReview={usersToReview} />
      </>
    );
  }

  return (
    <>
      {isLoadingUsersToReview && <Loader />}
      <Feedback
        topics={["agency-user-for-dashboard", "agency-users-to-review"]}
        closable
        className={fr.cx("fr-mb-2w", "fr-mt-0")}
      />
      <HeadingSection
        className={fr.cx("fr-mt-0")}
        title="Mes Organismes"
        titleAs="h2"
        titleAction={
          <Button
            id={domElementIds.agencyDashboard.registerAgencies.newAgencyButton}
            linkProps={{ href: immersionFacileAgencyRegistrationHelpFormUrl }}
          >
            Inscrire un nouvel organisme
          </Button>
        }
      >
        {usersToReview.length > 0 && (
          <HeadingSection
            title="Tâches à traiter"
            titleAs="h3"
            className={fr.cx("fr-mt-2w", "fr-mb-6w")}
          >
            <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
              <TaskSummary
                count={usersToReview.length}
                countLabel={`${usersToReview.length > 1 ? "Rattachements" : "Rattachement"} en attente`}
                icon="fr-icon-edit-line"
                buttonProps={{
                  children: "Traiter cette liste",
                  onClick: () => setHasRequestedUsersToReview(true),
                }}
              />
            </div>
          </HeadingSection>
        )}
        {agenciesUserIsAdminOn.length > 0 && (
          <AgencyRightsTable
            agencyRights={agenciesUserIsAdminOn}
            user={currentUser}
            title={`Organismes sur lesquels vous êtes administrateur (${agenciesUserIsAdminOn.length} organismes)`}
            modalId={domElementIds.agencyDashboard.agencyTab.adminRightsModal}
            onUserUpdateRequested={onUserUpdateRequested(
              "agency-user-for-dashboard",
            )}
          />
        )}

        {agenciesUserIsNotAdminOn.length > 0 && (
          <AgencyRightsTable
            agencyRights={agenciesUserIsNotAdminOn}
            user={currentUser}
            title={`Organismes auxquels vous êtes rattaché (${agenciesUserIsNotAdminOn.length} organismes)`}
            modalId={domElementIds.agencyDashboard.agencyTab.userRightsModal}
            onUserUpdateRequested={onUserUpdateRequested(
              "agency-user-for-dashboard",
            )}
          />
        )}
      </HeadingSection>
    </>
  );
};
