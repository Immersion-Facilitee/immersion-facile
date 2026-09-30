import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { Loader, PageHeader } from "react-design-system";
import { domElementIds, frontRoutes } from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { RequestRegisterEstablishmentsForUserForm } from "src/app/components/forms/register-establishments/RequestRegisterEstablishmentsForUserForm";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";

export const EstablishmentUserRegistrationPage = () => {
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
        title={"Se rattacher à une entreprise"}
        badge={
          <Button
            id={domElementIds.establishmentUserRegistration.backButton}
            linkProps={
              frontRoutes.establishmentDashboardFormEstablishment().link
            }
            priority={"secondary"}
            size="small"
            className={fr.cx("fr-mb-6w")}
            iconId="fr-icon-arrow-go-back-line"
          >
            Retour au tableau de bord
          </Button>
        }
      >
        Bonjour {currentUser.firstName} {currentUser.lastName}, recherchez une
        entreprise afin d'accéder aux offres et mises en relation de cette
        dernière. Un administrateur vérifiera et validera votre demande.
      </PageHeader>
      <div className={fr.cx("fr-container", "fr-mt-2w", "fr-mb-8w")}>
        <Feedback
          topics={["establishment-user-registration"]}
          closable
          className={fr.cx("fr-mb-2w")}
        />
        <RequestRegisterEstablishmentsForUserForm currentUser={currentUser} />
      </div>
    </>
  );
};
