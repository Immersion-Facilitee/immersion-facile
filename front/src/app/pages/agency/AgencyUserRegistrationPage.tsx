import { Loader } from "react-design-system";
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
