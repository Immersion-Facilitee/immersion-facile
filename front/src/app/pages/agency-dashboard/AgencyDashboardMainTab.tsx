import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { subMinutes } from "date-fns";
import { useEffect, useMemo } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import { type AgencyRight, distinguishAgencyRights } from "shared";
import { NoActiveAgencyRights } from "src/app/components/agency/agency-dashboard/NoActiveAgencyRights";
import { SelfRemoveUserAgencyRightFeedback } from "src/app/components/agency/removeUserAgencyRights";
import { Feedback } from "src/app/components/feedback/Feedback";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { FrontAgencyDashboardRoute } from "src/app/pages/auth/ConnectedPrivateRoutePage";
import { agenciesSlice } from "src/core-logic/domain/agencies/agencies.slice";
import { removeUserFromAgencySlice } from "src/core-logic/domain/agencies/remove-user-from-agency/removeUserFromAgency.slice";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { match, P } from "ts-pattern";
import { AgencyDashboard } from "../../components/agency/agency-dashboard/AgencyDashboard";
import { RegisterAgenciesForm } from "../../components/forms/register-agencies/RegisterAgenciesForm";

export const AgencyDashboardMainTab = ({
  route,
}: {
  route: FrontAgencyDashboardRoute;
}) => {
  const dispatch = useDispatch();
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isLoading = useAppSelector(connectedUserSelectors.isLoading);
  const { activeAgencyRights, toReviewAgencyRights } = useMemo(
    () => distinguishAgencyRights(currentUser?.agencyRights ?? []),
    [currentUser?.agencyRights],
  );

  const feedbackTopic: FeedbackTopic = "dashboard-agency-register-user";

  useEffect(() => {
    if (currentUser?.proConnect)
      dispatch(
        agenciesSlice.actions.fetchAgencyOptionsRequested({
          siret: currentUser.proConnect.siret,
          status: ["active", "from-api-PE"],
        }),
      );
  }, [dispatch, currentUser]);

  return (
    <>
      <h1>Mon espace prescripteur</h1>
      {isLoading && <Loader />}
      <Feedback topics={[feedbackTopic]} />
      <SelfRemoveUserAgencyRightFeedback />

      {match({ currentUser })
        .with(
          {
            currentUser: {
              agencyRights: [],
            },
          },
          ({ currentUser }) => {
            const fullName =
              `${currentUser.firstName} ${currentUser.lastName}`.trim();
            if (new Date(currentUser.createdAt) > subMinutes(new Date(), 1))
              return (
                <Alert
                  severity="warning"
                  title="Rattachement à vos organismes en cours"
                  description="Vous êtes bien connecté. Nous sommes en train de vérifier si vous avez des organismes rattachées à votre compte. Merci de patienter. Ça ne devrait pas prendre plus d'une minute. Veuillez recharger la page après ce délai."
                />
              );
            return (
              <>
                {currentUser.proConnect ? (
                  <strong className={fr.cx("fr-mt-4w", "fr-text--lead")}>
                    Bonjour{fullName ? ` ${fullName}` : ""}, vous avez
                    sélectionné le SIRET {currentUser.proConnect.siret} lors de
                    la création de votre compte sur ProConnect
                  </strong>
                ) : (
                  <p>
                    Bonjour{fullName ? ` ${fullName}` : ""}, recherchez un
                    organisme afin d'accéder aux conventions et statistiques de
                    ce dernier. Un administrateur vérifiera et validera votre
                    demande.
                  </p>
                )}

                <RegisterAgenciesForm currentUser={currentUser} />
              </>
            );
          },
        )
        .with(
          {
            currentUser: P.not(null),
          },
          ({ currentUser }) => {
            const onUserRegistrationCancelledRequested =
              (feedbackTopic: FeedbackTopic) => (agencyRight: AgencyRight) => {
                dispatch(
                  removeUserFromAgencySlice.actions.removeUserFromAgencyRequested(
                    {
                      agencyId: agencyRight.agency.id,
                      feedbackTopic,
                      userId: currentUser.id,
                    },
                  ),
                );
              };

            return activeAgencyRights.length ? (
              <AgencyDashboard
                route={route}
                activeAgencyRights={activeAgencyRights}
                dashboards={currentUser.dashboards}
              />
            ) : (
              <NoActiveAgencyRights
                toReviewAgencyRights={toReviewAgencyRights}
                currentUser={currentUser}
                onUserRegistrationCancelledRequested={onUserRegistrationCancelledRequested(
                  feedbackTopic,
                )}
              />
            );
          },
        )
        .otherwise(() => null)}
    </>
  );
};
