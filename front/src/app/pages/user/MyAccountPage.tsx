import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import Button from "@codegouvfr/react-dsfr/Button";
import Card from "@codegouvfr/react-dsfr/Card";
import Avatar from "@codegouvfr/react-dsfr/picto/Avatar";
import { useEffect } from "react";
import { Loader, SectionHighlight } from "react-design-system";
import { useDispatch } from "react-redux";
import { type ConnectedUser, domElementIds, frontRoutes } from "shared";
import { defaultAncestor } from "src/app/contents/breadcrumbs/breadcrumbs";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { commonIllustrations } from "src/assets/img/illustrations";
import { ENV } from "src/config/environmentVariables";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";

type QuickAccessCard = {
  id: string;
  title: string;
  description: string;
  illustration: string;
  linkProps: ReturnType<typeof frontRoutes.myAccount>["link"];
};

const proConnectPersonalInformationUrl =
  ENV.envType === "production"
    ? "https://app.moncomptepro.beta.gouv.fr/personal-information"
    : "https://app-preprod.moncomptepro.beta.gouv.fr/personal-information";

const quickAccessCards: QuickAccessCard[] = [
  {
    id: domElementIds.myAccount.beneficiaryDashboardLink,
    title: "Espace candidat",
    description:
      "Suivez vos candidatures auprès des entreprises et accédez au détail de vos conventions d’immersion.",
    illustration: commonIllustrations.candidate,
    linkProps: frontRoutes.beneficiaryDashboard().link,
  },
  {
    id: domElementIds.myAccount.establishmentDashboardLink,
    title: "Espace entreprise",
    description:
      "Gérez les offres d'immersion, les candidatures et les conventions de vos entreprises.",
    illustration: commonIllustrations.structureAccueil,
    linkProps: frontRoutes.establishmentDashboard().link,
  },
  {
    id: domElementIds.myAccount.agencyDashboardLink,
    title: "Espace prescripteur",
    description:
      "Prescrivez des immersions pour vos bénéficiaires, suivez vos conventions et statistiques.",
    illustration: commonIllustrations.discussions,
    linkProps: frontRoutes.agencyDashboard().link,
  },
];

export const MyAccountPage = () => {
  const dispatch = useDispatch();
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isLoadingUser = useAppSelector(connectedUserSelectors.isLoading);
  const federatedIdentity = useAppSelector(authSelectors.federatedIdentity);

  useEffect(() => {
    dispatch(feedbackSlice.actions.clearFeedbacksTriggered());
  }, [dispatch]);

  if (isLoadingUser) return <Loader />;

  if (!currentUser) return <p>Vous n'êtes pas connecté...</p>;

  return (
    <>
      <Breadcrumb
        className={fr.cx("fr-mt-0")}
        segments={[defaultAncestor]}
        currentPageLabel="Mon compte"
      />
      <h1>Mon compte</h1>
      <PersonalInformations
        user={currentUser}
        isConnectedWithProConnect={federatedIdentity?.provider === "proConnect"}
      />
      <h2 className={fr.cx("fr-mt-6w", "fr-mb-1w")}>Mes accès rapides</h2>
      <p className={fr.cx("fr-text--sm", "fr-mb-3w")}>
        Retrouvez les différents espaces d'Immersion Facilitée et accédez
        directement à celui dont vous avez besoin.
      </p>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        {quickAccessCards.map((card) => (
          <div key={card.id} className={fr.cx("fr-col-12", "fr-col-md-4")}>
            <Card
              title={card.title}
              titleAs="h3"
              desc={card.description}
              start={<img src={card.illustration} alt="" width={96} />}
              footer={
                <Button id={card.id} linkProps={card.linkProps} size="small">
                  Accéder à cet espace
                </Button>
              }
              border
            />
          </div>
        ))}
      </div>
    </>
  );
};

const PersonalInformations = ({
  user,
  isConnectedWithProConnect,
}: {
  user: ConnectedUser;
  isConnectedWithProConnect: boolean;
}) => (
  <SectionHighlight priority="discrete" className={fr.cx("fr-p-3w")}>
    <div
      className={fr.cx(
        "fr-grid-row",
        "fr-grid-row--gutters",
        "fr-grid-row--middle",
      )}
    >
      <div className={fr.cx("fr-col-2", "fr-col-md-1")}>
        <Avatar fontSize="3rem" />
      </div>
      <div
        className={fr.cx(
          "fr-col-10",
          isConnectedWithProConnect ? "fr-col-md-8" : "fr-col-md-11",
        )}
      >
        <h2 className={fr.cx("fr-h5", "fr-mb-1v")}>
          Informations personnelles
        </h2>
        <p className={fr.cx("fr-mb-0")}>
          {isConnectedWithProConnect
            ? "Vous êtes actuellement connecté avec votre compte ProConnect : "
            : "Vous êtes actuellement connecté avec : "}
          <span id={domElementIds.myAccount.email}>{user.email}</span>
          <br />
          {isConnectedWithProConnect
            ? "Pour modifier vos informations personnelles, rendez-vous sur votre compte ProConnect."
            : "La modification de vos informations n’est pas encore disponible depuis Immersion Facilitée."}
        </p>
      </div>
      {isConnectedWithProConnect && (
        <div
          className={fr.cx(
            "fr-col-12",
            "fr-col-md-3",
            "fr-grid-row",
            "fr-grid-row--right",
          )}
        >
          <Button
            id={domElementIds.myAccount.updateOwnInfosLink}
            priority="secondary"
            size="small"
            linkProps={{
              href: proConnectPersonalInformationUrl,
              target: "_blank",
            }}
          >
            Modifier mes informations
          </Button>
        </div>
      )}
    </div>
  </SectionHighlight>
);
