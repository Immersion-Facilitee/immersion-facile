import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { Loader, PageHeader } from "react-design-system";
import { domElementIds, frontRoutes } from "shared";
import { Breadcrumbs } from "src/app/components/Breadcrumbs";
import { Feedback } from "src/app/components/feedback/Feedback";
import { RegisterAgenciesForm } from "src/app/components/forms/register-agencies/RegisterAgenciesForm";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";

export const AgencyRegistrationPage = (): JSX.Element => {
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isLoading = useAppSelector(connectedUserSelectors.isLoading);

  if (isLoading) {
    return <Loader />;
  }
  if (!currentUser)
    return <p>Merci de vous connecter pour accéder à cette page.</p>;
  return (
    <>
      <PageHeader
        title={"Demander l'accès à des organismes"}
        breadcrumbs={<Breadcrumbs />}
        badge={
          <Button
            id={domElementIds.agencyDashboardRegistration.backButton}
            linkProps={frontRoutes.agencyDashboardAgencies().link}
            priority={"secondary"}
            className={fr.cx("fr-mb-6w")}
          >
            Retour au tableau de bord
          </Button>
        }
      >
        Bonjour {currentUser.firstName} {currentUser.lastName}, recherchez un
        organisme afin d'accéder aux conventions et statistiques de ce dernier.
        Un administrateur vérifiera et validera votre demande.
      </PageHeader>
      <div className={fr.cx("fr-container", "fr-mt-2w", "fr-mb-8w")}>
        <Feedback topics={["dashboard-agency-register-user"]} closable />
        <RegisterAgenciesForm currentUser={currentUser} />
      </div>
    </>
  );
};
