import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import Button from "@codegouvfr/react-dsfr/Button";
import { Loader, PageHeader } from "react-design-system";
import {
  type AgencyRegistrationFromRoute,
  domElementIds,
  frontRoutes,
} from "shared";
import { Feedback } from "src/app/components/feedback/Feedback";
import { RegisterAgenciesForm } from "src/app/components/forms/register-agencies/RegisterAgenciesForm";
import { defaultAncestor } from "src/app/contents/breadcrumbs/breadcrumbs";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import type { Route } from "type-route";

const defaultAgencyRegistrationFromRoute: AgencyRegistrationFromRoute =
  "myAccount";

const agencyRegistrationOriginNavigation: Record<
  AgencyRegistrationFromRoute,
  { backLabel: string; breadcrumbLabel: string }
> = {
  myAccount: {
    backLabel: "Retourner sur mon profil",
    breadcrumbLabel: "Mon profil",
  },
  agencyDashboardAgencies: {
    backLabel: "Retour au tableau de bord",
    breadcrumbLabel: "Tableau de bord",
  },
};

export const RequestAgencyRegistrationTab = ({
  route,
}: {
  route: Route<typeof frontRoutes.agencyRegistration>;
}): JSX.Element => {
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isLoading = useAppSelector(connectedUserSelectors.isLoading);
  const fromRoute =
    route.params.fromRoute ?? defaultAgencyRegistrationFromRoute;
  const backNavigation = getAgencyRegistrationBackNavigation(fromRoute);

  if (isLoading) {
    return <Loader />;
  }
  if (!currentUser)
    return <p>Merci de vous connecter pour accéder à cette page.</p>;
  return (
    <>
      <PageHeader
        title={"Demander l'accès à des organismes"}
        breadcrumbs={<AgencyRegistrationBreadcrumbs fromRoute={fromRoute} />}
        badge={
          <Button
            id={domElementIds.agencyRegistration.backButton}
            linkProps={backNavigation.linkProps}
            priority={"secondary"}
            className={fr.cx("fr-mb-6w")}
          >
            {backNavigation.label}
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

const getAgencyRegistrationBackNavigation = (
  fromRoute: AgencyRegistrationFromRoute,
): {
  label: string;
  linkProps: ReturnType<(typeof frontRoutes)["myAccount"]>["link"];
} => ({
  label: agencyRegistrationOriginNavigation[fromRoute].backLabel,
  linkProps: frontRoutes[fromRoute]().link,
});

const AgencyRegistrationBreadcrumbs = ({
  fromRoute,
}: {
  fromRoute: AgencyRegistrationFromRoute;
}): JSX.Element => (
  <div className={fr.cx("fr-container", "fr-mt-4w")}>
    <Breadcrumb
      segments={[
        defaultAncestor,
        {
          label: agencyRegistrationOriginNavigation[fromRoute].breadcrumbLabel,
          linkProps: frontRoutes[fromRoute]().link,
        },
      ]}
      currentPageLabel="Demander l'accès à des organismes"
    />
  </div>
);
