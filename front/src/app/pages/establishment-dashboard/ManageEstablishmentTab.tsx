import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";

import { HeadingSection } from "react-design-system";
import {
  type AcceptedUserEstablishmentRightDetails,
  domElementIds,
  type Email,
  frontRoutes,
  type PendingUserEstablishmentRightDetails,
} from "shared";
import { EstablishmentsList } from "src/app/components/establishment/establishment-dashboard/EstablishmentsList";
import { EstablishmentsRightsTable } from "src/app/components/establishment/establishments-table/EstablishmentsRightsTable";
import { EstablishmentForm } from "src/app/components/forms/establishment/EstablishmentForm";
import { makeUseTypedRoute } from "src/app/routes/routes.hooks";

type ManageEstablishmentTabProps = {
  establishments: AcceptedUserEstablishmentRightDetails[];
  pendingEstablishmentRights: PendingUserEstablishmentRightDetails[];
  currentUserEmail: Email;
  isBackofficeAdmin: boolean | undefined;
};

const useEstablishmentDashboardFormEstablishmentRoute =
  makeUseTypedRoute<
    (typeof frontRoutes.establishmentDashboardFormEstablishment)["name"]
  >();

export const ManageEstablishmentsTab = ({
  establishments,
  pendingEstablishmentRights,
  currentUserEmail,
  isBackofficeAdmin,
}: ManageEstablishmentTabProps) => {
  const route = useEstablishmentDashboardFormEstablishmentRoute([
    "establishmentDashboardFormEstablishment",
  ]);
  const { siret, shouldUpdateAvailability } = route.params;
  return (
    <>
      <HeadingSection
        title={`Mes entreprises (${establishments.length})`}
        titleAs="h2"
        className={fr.cx("fr-mt-0", "fr-mb-4w")}
        titleAction={
          <ButtonsGroup
            buttons={[
              {
                id: domElementIds.establishmentDashboard.manageEstablishments
                  .createEstablishmentForAlreadyRegisteredUser,
                priority: "secondary",
                onClick: () => {
                  frontRoutes.formEstablishment().push();
                },
                iconId: "fr-icon-add-line",
                children: "Inscrire une nouvelle entreprise",
              },
              {
                id: domElementIds.establishmentDashboard.manageEstablishments
                  .registerEstablishmentButtonForAlreadyRegisteredUser,

                priority: "primary",
                onClick: () => {
                  frontRoutes.establishmentUserRegistration().push();
                },
                iconId: "fr-icon-add-line",
                children: "Se rattacher à une entreprise",
              },
            ]}
            inlineLayoutWhen="always"
            className={fr.cx("fr-ml-auto")}
          />
        }
      >
        <EstablishmentsRightsTable
          title={
            <h4 className={fr.cx("fr-h6", "fr-mt-4w")}>
              Mes demandes d'accès envoyées
            </h4>
          }
          withEstablishmentData={pendingEstablishmentRights}
          isBackofficeAdmin={isBackofficeAdmin}
        />
      </HeadingSection>
      <div className={fr.cx("fr-mb-4w")}>
        {siret ? (
          <>
            <Button
              id={
                domElementIds.establishmentDashboard.manageEstablishments
                  .backToEstablishmentsButton
              }
              priority="tertiary"
              iconId="fr-icon-arrow-left-line"
              className={fr.cx("fr-mb-3w")}
              linkProps={
                frontRoutes.establishmentDashboardFormEstablishment().link
              }
            >
              Retour à mes entreprises
            </Button>
            <EstablishmentForm mode="edit" key={siret} />
          </>
        ) : (
          establishments.length > 0 && (
            <EstablishmentsList
              establishments={establishments}
              currentUserEmail={currentUserEmail}
              isBackofficeAdmin={isBackofficeAdmin}
              shouldUpdateAvailability={shouldUpdateAvailability}
            />
          )
        )}
      </div>
    </>
  );
};
