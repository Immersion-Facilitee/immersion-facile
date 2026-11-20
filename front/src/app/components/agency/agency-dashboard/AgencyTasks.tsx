import { fr } from "@codegouvfr/react-dsfr";
import { addDays, subMonths } from "date-fns";
import { type ReactNode, useEffect, useMemo } from "react";
import {
  HeadingSection,
  Loader,
  TaskSummary,
  type TitleLevel,
} from "react-design-system";
import { useDispatch } from "react-redux";
import {
  activeAgencyStatuses,
  agencyRoleIsNotToReview,
  NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
} from "shared";
import { AgencyAdminUsersToReview } from "src/app/components/agency/agency-dashboard/AgencyAdminUsersToReview";
import { ConventionsToManageList } from "src/app/components/agency/agency-dashboard/ConventionsToManageList";
import { ConventionsWithAssessmentToCompleteList } from "src/app/components/agency/agency-dashboard/ConventionsWithAssessmentToCompleteList";
import { ConventionsWithBroadcastErrorList } from "src/app/components/agency/agency-dashboard/ConventionsWithBroadcastErrorList";
import { hasUserRightsOnAgencyBroadcast } from "src/app/components/forms/convention/manage-actions/getButtonConfigBySubStatus";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { usersToReviewSelectors } from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.selectors";
import { usersToReviewSlice } from "src/core-logic/domain/agency-admin/usersToReview/usersToReview.slice";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { connectedUserConventionsToManageSelectors } from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.selectors";
import { connectedUserConventionsToManageSlice } from "src/core-logic/domain/connected-user/conventionsToManage/connectedUserConventionsToManage.slice";
import { conventionsWithBroadcastFeedbackSelectors } from "src/core-logic/domain/connected-user/conventionsWithBroadcastFeedback/conventionsWithBroadcastFeedback.selectors";
import { conventionsWithBroadcastFeedbackSlice } from "src/core-logic/domain/connected-user/conventionsWithBroadcastFeedback/conventionsWithBroadcastFeedback.slice";

export const AgencyTasks = ({
  titleAs,
  onSeeAllConventionsClick,
}: {
  titleAs: TitleLevel;
  onSeeAllConventionsClick: (element: ReactNode) => void;
}) => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);

  const isLoadingConventionsToManage = useAppSelector(
    connectedUserConventionsToManageSelectors.isLoading,
  );
  const isLoadingConventionsWithUnfinalizedAssessment = useAppSelector(
    connectedUserConventionsToManageSelectors.isLoadingConventionsWithUnfinalizedAssessment,
  );
  const isLoadingConventionsWithBroadcastError = useAppSelector(
    conventionsWithBroadcastFeedbackSelectors.isLoading,
  );
  const conventionsToManagePagination = useAppSelector(
    connectedUserConventionsToManageSelectors.pagination,
  );
  const conventionsWithUnfinalizedAssessmentPagination = useAppSelector(
    connectedUserConventionsToManageSelectors.conventionsWithUnfinalizedAssessmentPagination,
  );
  const conventionsWithErroredBroadcastFeedbackPagination = useAppSelector(
    conventionsWithBroadcastFeedbackSelectors.erroredBroadcastConventionsWithPagination,
  );
  const usersToReview = useAppSelector(usersToReviewSelectors.usersToReview);
  const isLoadingUsersToReview = useAppSelector(
    usersToReviewSelectors.isLoading,
  );
  const usersToReviewFetch = useMemo(() => {
    const activeAgencyRights = (currentUser?.agencyRights ?? []).filter(
      (agencyRight) =>
        agencyRoleIsNotToReview(agencyRight.roles) &&
        activeAgencyStatuses.includes(agencyRight.agency.status),
    );
    const adminAgencies = activeAgencyRights
      .filter((agencyRight) => agencyRight.roles.includes("agency-admin"))
      .map((agencyRight) => agencyRight.agency);

    if (adminAgencies.length > 0) {
      return { agencies: adminAgencies, canManageUsersToReview: true };
    }

    if (activeAgencyRights.length === 1) {
      return {
        agencies: [activeAgencyRights[0].agency],
        canManageUsersToReview: false,
      };
    }

    return { agencies: [], canManageUsersToReview: false };
  }, [currentUser?.agencyRights]);
  const dateStartFrom1MonthAgoToIn5Days = useMemo(
    () => ({
      dateStartFrom: subMonths(new Date(), 1).toISOString(),
      dateStartTo: addDays(new Date(), 5).toISOString(),
    }),
    [],
  );

  useEffect(() => {
    if (connectedUserJwt) {
      dispatch(
        connectedUserConventionsToManageSlice.actions.getConventionsForConnectedUserRequested(
          {
            params: {
              ...dateStartFrom1MonthAgoToIn5Days,
              sortBy: "dateStart",
              sortDirection: "asc",
              statuses: [
                "READY_TO_SIGN",
                "PARTIALLY_SIGNED",
                "IN_REVIEW",
                "ACCEPTED_BY_COUNSELLOR",
              ],
              page: 1,
              perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
            },
            jwt: connectedUserJwt,
            feedbackTopic: "connected-user-conventions",
          },
        ),
      );
      dispatch(
        connectedUserConventionsToManageSlice.actions.getConventionsWithUnfinalizedAssessmentRequested(
          {
            filters: {
              page: 1,
              perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
            },
            jwt: connectedUserJwt,
            feedbackTopic: "conventions-with-unfinalized-assessment",
          },
        ),
      );
    }
  }, [connectedUserJwt, dateStartFrom1MonthAgoToIn5Days, dispatch]);

  useEffect(() => {
    if (
      connectedUserJwt &&
      currentUser &&
      hasUserRightsOnAgencyBroadcast(currentUser)
    ) {
      dispatch(
        conventionsWithBroadcastFeedbackSlice.actions.getConventionsWithErroredBroadcastFeedbackRequested(
          {
            filters: {
              page: 1,
              perPage: NUMBER_ITEM_TO_DISPLAY_IN_PAGINATED_PAGE,
              broadcastErrorKind: "functional",
            },
            jwt: connectedUserJwt,
            feedbackTopic: "conventions-with-broadcast-feedback",
          },
        ),
      );
    }
  }, [connectedUserJwt, currentUser, dispatch]);

  useEffect(() => {
    if (!connectedUserJwt || usersToReviewFetch.agencies.length === 0) return;

    dispatch(
      usersToReviewSlice.actions.fetchUsersToReviewRequested({
        agencies: usersToReviewFetch.agencies,
        feedbackTopic: "agency-users-to-review",
      }),
    );
  }, [connectedUserJwt, dispatch, usersToReviewFetch.agencies]);

  const isLoadingTasks =
    isLoadingConventionsToManage ||
    isLoadingConventionsWithUnfinalizedAssessment ||
    isLoadingConventionsWithBroadcastError ||
    isLoadingUsersToReview;

  const hasNoPendingUsersToReview =
    usersToReviewFetch.agencies.length === 0 || usersToReview.length === 0;

  const hasNoUrgentTasks =
    currentUser !== null &&
    !isLoadingTasks &&
    conventionsToManagePagination?.totalRecords === 0 &&
    conventionsWithUnfinalizedAssessmentPagination?.totalRecords === 0 &&
    conventionsWithErroredBroadcastFeedbackPagination.pagination
      .totalRecords === 0 &&
    hasNoPendingUsersToReview;

  return (
    <HeadingSection
      title="Tâches à traiter"
      titleAs={titleAs}
      className={fr.cx("fr-mt-2w", "fr-mb-4w")}
    >
      {isLoadingTasks && <Loader />}
      {hasNoUrgentTasks && (
        <p>
          Tout est à jour ! 🎉 Vous n’avez aucune action urgente à effectuer
          pour le moment. <br />
          Pensez à consulter le tableau des conventions pour suivre leur
          avancement ou préparer vos prochaines démarches.
        </p>
      )}
      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        {conventionsToManagePagination?.totalRecords !== undefined &&
          conventionsToManagePagination.totalRecords > 0 && (
            <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
              <TaskSummary
                count={conventionsToManagePagination.totalRecords}
                countLabel="Actions urgentes"
                icon="fr-icon-edit-line"
                buttonProps={{
                  children: "Traiter cette liste",
                  onClick: () =>
                    onSeeAllConventionsClick(
                      <ConventionsToManageList
                        title="Actions urgentes"
                        dateRange={dateStartFrom1MonthAgoToIn5Days}
                      />,
                    ),
                }}
              />
            </div>
          )}
        {conventionsWithUnfinalizedAssessmentPagination?.totalRecords !==
          undefined &&
          conventionsWithUnfinalizedAssessmentPagination.totalRecords > 0 && (
            <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
              <TaskSummary
                count={
                  conventionsWithUnfinalizedAssessmentPagination.totalRecords
                }
                countLabel="Relances bilans"
                icon="fr-icon-file-text-line"
                buttonProps={{
                  children: "Traiter cette liste",
                  onClick: () =>
                    onSeeAllConventionsClick(
                      <ConventionsWithAssessmentToCompleteList />,
                    ),
                }}
              />
            </div>
          )}
        {currentUser &&
          hasUserRightsOnAgencyBroadcast(currentUser) &&
          conventionsWithErroredBroadcastFeedbackPagination?.pagination
            ?.totalRecords !== undefined &&
          conventionsWithErroredBroadcastFeedbackPagination.pagination
            .totalRecords > 0 && (
            <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
              <TaskSummary
                count={
                  conventionsWithErroredBroadcastFeedbackPagination.pagination
                    .totalRecords
                }
                countLabel="Conventions à vérifier"
                icon="fr-icon-link-unlink"
                buttonProps={{
                  children: "Traiter cette liste",
                  onClick: () =>
                    onSeeAllConventionsClick(
                      <ConventionsWithBroadcastErrorList title="Conventions à vérifier" />,
                    ),
                }}
              />
            </div>
          )}
        {usersToReviewFetch.agencies.length > 0 &&
          !isLoadingUsersToReview &&
          usersToReview.length > 0 && (
            <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
              <TaskSummary
                count={usersToReview.length}
                countLabel={`${usersToReview.length > 1 ? "Rattachements" : "Rattachement"} en attente`}
                icon="fr-icon-edit-line"
                {...(usersToReviewFetch.canManageUsersToReview
                  ? {
                      buttonProps: {
                        children: "Traiter cette liste",
                        onClick: () =>
                          onSeeAllConventionsClick(
                            <AgencyAdminUsersToReview />,
                          ),
                      },
                    }
                  : {
                      detail: "Gestion réservée aux administrateurs",
                    })}
              />
            </div>
          )}
      </div>
    </HeadingSection>
  );
};
