import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { type ReactNode, useEffect } from "react";
import { Loader } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  frontRoutes,
  getDisplayedBusinessName,
  onlyAdminUserRightsWithStatusAccepted,
} from "shared";
import { EstablishmentForm } from "src/app/components/forms/establishment/EstablishmentForm";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { frontErrors } from "src/app/pages/error/front-errors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { establishmentSelectors } from "src/core-logic/domain/establishment/establishment.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { geocodingSlice } from "src/core-logic/domain/geocoding/geocoding.slice";
import { siretSlice } from "src/core-logic/domain/siret/siret.slice";
import type { Route } from "type-route";

type EstablishmentDetailPageProps = {
  route: Route<typeof frontRoutes.establishmentDashboardEstablishmentDetail>;
};

export const EstablishmentDetailPage = ({
  route,
}: EstablishmentDetailPageProps): ReactNode => {
  const dispatch = useDispatch();
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const isLoadingUser = useAppSelector(connectedUserSelectors.isLoading);
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

  if (!siret) throw frontErrors.establishment.missingSiret();

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
      <EstablishmentForm mode="edit" key={siret} />
    </>
  );
};
