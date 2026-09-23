import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { Loader, PageHeader } from "react-design-system";
import { frontRoutes } from "shared";
import { Breadcrumbs } from "src/app/components/Breadcrumbs";
import { Feedback } from "src/app/components/feedback/Feedback";
import { RequestRegisterEstablishmentsForUserForm } from "src/app/components/forms/register-establishments/RequestRegisterEstablishmentsForUserForm";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";

export const RequestEstablishmentRegistrationTab = () => {
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
        breadcrumbs={<Breadcrumbs />}
        badge={
          <Button
            linkProps={frontRoutes.myAccount().link}
            priority={"secondary"}
            size="small"
            className={fr.cx("fr-mb-6w")}
            iconId="fr-icon-arrow-go-back-line"
          >
            Retourner sur mon compte
          </Button>
        }
      >
        Bonjour {currentUser.firstName} {currentUser.lastName}, recherchez une
        entreprise afin d'accéder aux offres et mises en relation de cette
        dernière. Un administrateur vérifiera et validera votre demande.
      </PageHeader>
      <div className={fr.cx("fr-container", "fr-mt-2w", "fr-mb-8w")}>
        <Feedback
          topics={["my-profile-establishment-registration"]}
          closable
          className={fr.cx("fr-mb-2w")}
        />
        <RequestRegisterEstablishmentsForUserForm currentUser={currentUser} />
      </div>
    </>
  );
};
