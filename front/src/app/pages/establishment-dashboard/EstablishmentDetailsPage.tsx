import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { type ReactNode, useCallback, useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  frontRoutes,
  getDisplayedBusinessName,
  onlyAdminUserRightsWithStatusAccepted,
} from "shared";
import { EstablishmentForm } from "src/app/components/forms/establishment/EstablishmentForm";
import type { EstablishmentEditTab } from "src/app/contents/forms/establishment/formEstablishment";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { establishmentSelectors } from "src/core-logic/domain/establishment/establishment.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { geocodingSlice } from "src/core-logic/domain/geocoding/geocoding.slice";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";
import type { Route } from "type-route";

type EstablishmentDetailsPageProps = {
  route: Route<
    | typeof frontRoutes.establishmentDashboardEstablishmentDetails
    | typeof frontRoutes.establishmentDashboardEstablishmentInformations
  >;
};

export const EstablishmentDetailsPage = ({
  route,
}: EstablishmentDetailsPageProps): ReactNode => {
  const dispatch = useDispatch();
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isLoadingUser = useAppSelector(connectedUserSelectors.isLoading);
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const formEstablishment = useAppSelector(
    establishmentSelectors.formEstablishment,
  );
  const siret = route.params.siret;

  const isUserNotAdminOfEstablishment =
    !!currentUser &&
    !currentUser.establishments?.some(
      (establishment) =>
        establishment.siret === siret &&
        onlyAdminUserRightsWithStatusAccepted(establishment),
    );

  useEffect(() => {
    if (isUserNotAdminOfEstablishment)
      frontRoutes.establishmentDashboardEstablishments().replace();
  }, [isUserNotAdminOfEstablishment]);

  useEffect(
    () => () => {
      dispatch(establishmentSlice.actions.clearEstablishmentRequested());
      dispatch(siretSlice.actions.siretInfoClearRequested());
      dispatch(
        geocodingSlice.actions.clearLocatorDataRequested({
          locator: "create-establishment-in-person-address",
        }),
      );
    },
    [dispatch],
  );

  const goToEstablishmentEditTab = useCallback(
    (tab: EstablishmentEditTab): void => {
      const params = { siret: formEstablishment.siret };
      if (tab === "informations") {
        frontRoutes
          .establishmentDashboardEstablishmentInformations(params)
          .push();
        return;
      }
      frontRoutes.establishmentDashboardEstablishmentDetails(params).push();
    },
    [formEstablishment.siret],
  );

  if (!currentUser)
    return isLoadingUser ? (
      <Loader />
    ) : (
      <Alert
        severity="error"
        title="Vous n'êtes pas connecté avec ProConnect."
      />
    );

  if (isUserNotAdminOfEstablishment) return null;

  return (
    <>
      {formEstablishment.siret === siret && (
        <h1 className={fr.cx("fr-mb-4w")}>
          {getDisplayedBusinessName(formEstablishment)}
        </h1>
      )}
      <EstablishmentForm
        mode="edit"
        key={siret}
        selectedTab={
          route.name === "establishmentDashboardEstablishmentInformations"
            ? "informations"
            : "offers"
        }
        onTabChange={goToEstablishmentEditTab}
        onOfferEditionRequested={(appellationCode) =>
          frontRoutes
            .establishmentDashboardEstablishmentOffer({
              siret: formEstablishment.siret,
              appellationCode,
            })
            .push()
        }
        onOfferDeletionRequested={(appellationCode) => {
          if (!connectedUserJwt) return;
          dispatch(
            establishmentSlice.actions.updateEstablishmentRequested({
              establishmentUpdate: {
                formEstablishment: {
                  ...formEstablishment,
                  offers: formEstablishment.offers.filter(
                    (offer) => offer.appellationCode !== appellationCode,
                  ),
                },
                jwt: connectedUserJwt,
              },
              feedbackTopic: "form-establishment",
            }),
          );
        }}
      />
    </>
  );
};
