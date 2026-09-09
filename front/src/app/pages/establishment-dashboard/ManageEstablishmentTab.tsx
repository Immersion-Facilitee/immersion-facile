import { fr } from "@codegouvfr/react-dsfr";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import Select from "@codegouvfr/react-dsfr/SelectNext";

import { HeadingSection } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  domElementIds,
  frontRoutes,
  type UserEstablishmentRightDetails,
} from "shared";
import { EstablishmentForm } from "src/app/components/forms/establishment/EstablishmentForm";
import { makeUseTypedRoute } from "src/app/routes/routes.hooks";
import { getUrlParameters } from "src/app/utils/url.utils";
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
  if (establishments.length === 1) {
    frontRoutes
      .establishmentDashboardFormEstablishment({
        siret: establishments[0].siret,
        shouldUpdateAvailability: initialUrlParams.shouldUpdateAvailability,
      })
      .push();
  }
  return (
    <HeadingSection
      title="Piloter votre établissement"
      titleAs="h2"
      className={fr.cx("fr-mt-0")}
      titleAction={
        <ButtonsGroup
          buttons={[
            {
              id: domElementIds.establishmentDashboard.manageEstablishments
                .createEstablishment,
              priority: "secondary",
              onClick: () => {
                frontRoutes.formEstablishment().push();
              },
              iconId: "fr-icon-add-line",
              children: "Créer un nouvel établissement",
            },
            {
              id: domElementIds.myAccountEstablishmentRegistration
                .registerEstablishmentButton,

              priority: "primary",
              onClick: () => {
                frontRoutes.myAccountEstablishmentRegistration().push();
              },
              iconId: "fr-icon-add-line",
              children: "Se rattacher à un établissement",
            },
          ]}
          inlineLayoutWhen="always"
          className={fr.cx("fr-ml-auto")}
        />
      }
    >
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
    </HeadingSection>
  );
};
