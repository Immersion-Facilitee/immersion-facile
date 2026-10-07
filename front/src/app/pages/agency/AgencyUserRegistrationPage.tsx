import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { Loader } from "react-design-system";
import { domElementIds, frontRoutes } from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { RegisterAgenciesForm } from "src/app/components/forms/register-agencies/RegisterAgenciesForm";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";

export const AgencyUserRegistrationPage = (): JSX.Element => {
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isLoading = useAppSelector(connectedUserSelectors.isLoading);

  if (isLoading) {
    return <Loader />;
  }
  if (!currentUser)
    return <p>Merci de vous connecter pour accéder à cette page.</p>;
  return (
    <>
      <Button
        id={domElementIds.agencyUserRegistration.backButton}
        linkProps={frontRoutes.agencyDashboardAgencies().link}
        priority={"secondary"}
        size="small"
        className={fr.cx("fr-mb-6w")}
        iconId="fr-icon-arrow-go-back-line"
      >
        Retour à mes organismes
      </Button>
      <h1>Demander l'accès à des organismes</h1>
      <p>
        Bonjour {currentUser.firstName} {currentUser.lastName}, recherchez un
        organisme afin d'accéder aux conventions et statistiques de ce dernier.
        Un administrateur vérifiera et validera votre demande.
      </p>
      <Feedback topics={["agency-user-registration"]} closable />
      <RegisterAgenciesForm currentUser={currentUser} />
    </>
  );
};
