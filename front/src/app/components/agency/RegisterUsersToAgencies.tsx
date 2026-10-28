import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Select } from "@codegouvfr/react-dsfr/SelectNext";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { domElementIds } from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUsersAdminSelectors } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.selectors";
import { connectedUsersAdminSlice } from "src/core-logic/domain/admin/connectedUsersAdmin/connectedUsersAdmin.slice";
import { match, P } from "ts-pattern";
import { BackofficeDashboardTabContent } from "../layout/BackofficeDashboardTabContent";
import { IcUserAgenciesToReview } from "./IcUserAgenciesToReview";

export const RegisterUsersToAgencies = () => {
  const dispatch = useDispatch();
  const usersNeedingReview = useAppSelector(
    connectedUsersAdminSelectors.connectedUsersNeedingReview,
  );
  const agenciesNeedingReviewForUser = useAppSelector(
    connectedUsersAdminSelectors.agenciesNeedingReviewForSelectedUser,
  );
  const selectedUser = useAppSelector(
    connectedUsersAdminSelectors.selectedUser,
  );
  const feedback = useAppSelector(connectedUsersAdminSelectors.feedback);

  useEffect(() => {
    dispatch(connectedUsersAdminSlice.actions.feedbackClearRequested());
    dispatch(
      connectedUsersAdminSlice.actions.fetchConnectedUsersToReviewRequested({
        agencyRole: "to-review",
      }),
    );
    return () => {
      dispatch(connectedUsersAdminSlice.actions.feedbackClearRequested());
    };
  }, [dispatch]);

  useEffect(() => {
    if (agenciesNeedingReviewForUser.length === 0) {
      dispatch(connectedUsersAdminSlice.actions.connectedUserSelected(null));
    }
  }, [agenciesNeedingReviewForUser, dispatch]);

  return (
    <BackofficeDashboardTabContent
      title="Rapprocher un utilisateur d'une agence"
      className={fr.cx("fr-mt-4w")}
    >
      <div className={fr.cx("fr-px-6w", "fr-py-4w", "fr-card", "fr-mb-4w")}>
        <Select
          label={`Sélectionner un utilisateur (${usersNeedingReview.length} en attente de validation)`}
          options={[
            ...usersNeedingReview
              .sort((a, b) => a.lastName.localeCompare(b.lastName))
              .map((user) => ({
                value: user.id,
                label: `${user.lastName} ${user.firstName} - ${user.email}`,
              })),
          ]}
          placeholder="Sélectionner un utilisateur"
          nativeSelectProps={{
            defaultValue: "",
            value: selectedUser?.id || "",
            id: domElementIds.admin.agencyTab.selectIcUserToReview,
            onChange: (event) => {
              const selectedUserToReview = usersNeedingReview.find(
                (icUser) => icUser.id === event.currentTarget.value,
              );
              if (!selectedUserToReview) return;
              dispatch(
                connectedUsersAdminSlice.actions.connectedUserSelected(
                  selectedUserToReview,
                ),
              );
            },
          }}
        />
        {match({ agenciesNeedingReviewForUser, feedback, selectedUser })
          .with(
            {
              agenciesNeedingReviewForUser: P.when(
                (agenciesNeedingReviewForUser) =>
                  agenciesNeedingReviewForUser.length > 0,
              ),
              feedback: P.when(
                (feedback) =>
                  feedback.kind === "agencyRegisterToUserSuccess" ||
                  feedback.kind === "usersToReviewFetchSuccess" ||
                  feedback.kind === "agencyRejectionForUserSuccess" ||
                  feedback.kind === "agencyUsersFetchSuccess",
              ),
              selectedUser: P.not(P.nullish),
            },
            ({ selectedUser }) => (
              <IcUserAgenciesToReview
                agenciesNeedingReviewForUser={agenciesNeedingReviewForUser}
                selectedUser={selectedUser}
              />
            ),
          )
          .with(
            {
              feedback: P.when(
                (feedback) => feedback.kind === "agencyRejectionForUserSuccess",
              ),
            },
            () => (
              <Alert
                severity="success"
                title="Beau travail !"
                description="Le rattachement de cet utilisateur à l'agence a bien été rejeté"
              />
            ),
          )
          .with(
            {
              agenciesNeedingReviewForUser: P.when(
                (agenciesNeedingReviewForUser) =>
                  agenciesNeedingReviewForUser.length === 0,
              ),
              feedback: P.when(
                (feedback) => feedback.kind === "agencyRegisterToUserSuccess",
              ),
            },
            () => (
              <Alert
                severity="success"
                title="Beau travail !"
                description="Toutes les agences disponibles ont été associées à cet utilisateur."
              />
            ),
          )
          .with(
            {
              agenciesNeedingReviewForUser: P.when(
                (agenciesNeedingReviewForUser) =>
                  agenciesNeedingReviewForUser.length === 0,
              ),
              feedback: P.when(
                (feedback) => feedback.kind === "usersToReviewFetchSuccess",
              ),
            },
            () => <></>,
          )
          .with(
            {
              feedback: P.when((feedback) => feedback.kind === "errored"),
            },
            () => (
              <Alert
                severity="error"
                title="Une erreur est survenue"
                description={
                  feedback.kind === "errored" && feedback.errorMessage
                }
              />
            ),
          )
          .otherwise(() => (
            <Alert
              severity="error"
              title="Un cas non géré a été rencontré"
              description={
                <img
                  src="https://media.giphy.com/media/fAo1Tv1OGE6AQZ2s0T/giphy.gif"
                  width={200}
                  alt=""
                />
              }
            />
          ))}
      </div>
    </BackofficeDashboardTabContent>
  );
};
