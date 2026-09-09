import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Select from "@codegouvfr/react-dsfr/SelectNext";

import { HeadingSection } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  frontRoutes,
  type UserEstablishmentRightDetails,
} from "shared";
import { EstablishmentsTablesSection } from "src/app/components/establishment/establishments-table/EstablishmentsTablesSection";
import { EstablishmentForm } from "src/app/components/forms/establishment/EstablishmentForm";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { makeUseTypedRoute } from "src/app/routes/routes.hooks";
import { getUrlParameters } from "src/app/utils/url.utils";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { geocodingSlice } from "src/core-logic/domain/geocoding/geocoding.slice";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";

type ManageEstablishmentTabProps = {
  establishments: UserEstablishmentRightDetails[];
};

const useEstablishmentDashboardFormEstablishmentRoute =
  makeUseTypedRoute<
    (typeof frontRoutes.establishmentDashboardFormEstablishment)["name"]
  >();

export const ManageEstablishmentsTab = ({
  establishments,
}: ManageEstablishmentTabProps) => {
  const dispatch = useDispatch();
  const route = useEstablishmentDashboardFormEstablishmentRoute([
    "establishmentDashboardFormEstablishment",
  ]);
  const { siret } = route.params;
  const initialUrlParams = getUrlParameters(window.location);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const pendingUserEstablishmentsRights =
    currentUser?.establishments?.filter(
      (userEstablishment) => userEstablishment.status === "PENDING",
    ) || [];

  if (establishments.length === 1) {
    frontRoutes
      .establishmentDashboardFormEstablishment({
        siret: establishments[0].siret,
        shouldUpdateAvailability: initialUrlParams.shouldUpdateAvailability,
      })
      .push();
  }
  return (
    <>
      <HeadingSection
        title="Mes établissements"
        description="Les entreprises auxquelles vous êtes rattaché·e et vos demandes en cours."
        titleAs="h2"
        className={fr.cx("fr-mt-0", "fr-mb-4w")}
        titleAction={
          <Button
            iconId="fr-icon-add-circle-line"
            type="button"
            onClick={() => {
              frontRoutes.formEstablishment().push();
            }}
            id={
              domElementIds.establishmentDashboard.manageEstablishments
                .createEstablishment
            }
          >
            Créer un nouvel établissement
          </Button>
        }
      >
        <h4 className={fr.cx("fr-h6", "fr-mt-4w")}>
          Mes demandes d'accès envoyées
        </h4>
        <EstablishmentsTablesSection
          withEstablishmentData={pendingUserEstablishmentsRights}
          isBackofficeAdmin={currentUser?.isBackofficeAdmin}
        />
      </HeadingSection>
      <div className={fr.cx("fr-mb-4w")}>
        {establishments.length > 1 && (
          <Select
            label={"Sélectionner un établissement"}
            options={[
              ...establishments.map((establishment) => ({
                value: establishment.siret,
                label: `${establishment.businessName}`,
              })),
            ]}
            placeholder="Sélectionner un établissement"
            nativeSelectProps={{
              defaultValue: "",
              value: siret,
              id: domElementIds.establishmentDashboard.manageEstablishments
                .selectEstablishmentInput,
              onChange: (event) => {
                dispatch(
                  establishmentSlice.actions.clearEstablishmentRequested(),
                );
                dispatch(siretSlice.actions.siretInfoClearRequested());
                dispatch(
                  geocodingSlice.actions.clearLocatorDataRequested({
                    locator: "create-establishment-in-person-address",
                  }),
                );
                frontRoutes
                  .establishmentDashboardFormEstablishment({
                    siret: event.currentTarget.value,
                  })
                  .push();
              },
            }}
          />
        )}
        {route.params.siret && (
          <EstablishmentForm mode="edit" key={route.params.siret} />
        )}
      </div>
    </>
  );
};
