import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Button from "@codegouvfr/react-dsfr/Button";
import Card from "@codegouvfr/react-dsfr/Card";
import Input from "@codegouvfr/react-dsfr/Input";
import {
  type ChangeEvent,
  type ElementRef,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader, useDebounce } from "react-design-system";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import {
  type ConnectedUser,
  domElementIds,
  frontRoutes,
  looksLikeSiret,
  type SiretDto,
} from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { EstablishmentUserForm } from "src/app/pages/establishment-dashboard/EstablishmentUserForm";
import { makeUseTypedRoute } from "src/app/routes/routes.hooks";
import { createFormModal } from "src/app/utils/createFormModal";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { establishmentSelectors } from "src/core-logic/domain/establishment/establishment.selectors";
import { establishmentSlice } from "src/core-logic/domain/establishment/establishment.slice";
import { match, P } from "ts-pattern";

const establishmentRegisterEstablishmentModal = createFormModal({
  id: "establishment-register-establishment-modal",
  isOpenedByDefault: false,
  formId: "establishment-register-establishment-form",
  doSubmitClosesModal: false,
});

const useEstablishmentUserRegistrationRoute =
  makeUseTypedRoute<
    (typeof frontRoutes.establishmentUserRegistration)["name"]
  >();

export const RequestRegisterEstablishmentsForUserForm = ({
  currentUser,
}: {
  currentUser: ConnectedUser;
}) => {
  const dispatch = useDispatch();
  const route = useEstablishmentUserRegistrationRoute([
    "establishmentUserRegistration",
  ]);
  const [inputValue, setInputValue] = useState<string | undefined>(undefined);
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const isLoading = useAppSelector(establishmentSelectors.isLoading);
  const establishmentPublicOptions = useAppSelector(
    establishmentSelectors.establishmentPublicOptions,
  );
  const establishmentPublicOptionsLength = establishmentPublicOptions.length;
  const establishmentSearchBySiretOrNameInput =
    useRef<ElementRef<"input">>(null);
  const debouncedInputValue = useDebounce(inputValue, 500);

  const [selectedEstablishmentSiret, setSelectedEstablishmentSiret] = useState<
    SiretDto | undefined
  >(undefined);

  const onEstablishmentSearchChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setInputValue(event.currentTarget.value);
    setSelectedEstablishmentSiret(undefined);
  };

  if (inputValue === undefined) {
    if (currentUser.proConnect) {
      setInputValue(currentUser.proConnect.siret);
    }
    if (route.params.siret) {
      setInputValue(route.params.siret);
    }
  }

  const getStatusOnEstablishment = (siret: SiretDto) => {
    const establishment = currentUser.establishments?.find(
      (establishment) => establishment.siret === siret,
    );
    return establishment?.status;
  };

  if (inputValue === undefined && currentUser.proConnect) {
    setInputValue(currentUser.proConnect.siret);
  }

  useEffect(() => {
    if (!connectedUserJwt || !debouncedInputValue) return;
    dispatch(
      establishmentSlice.actions.fetchEstablishmentPublicOptionsRequested({
        filters: {
          [looksLikeSiret(debouncedInputValue) ? "siret" : "nameIncludes"]:
            debouncedInputValue,
        },
        jwt: connectedUserJwt,
        feedbackTopic: "establishment-user-registration",
      }),
    );
  }, [debouncedInputValue, connectedUserJwt, dispatch]);

  return (
    <>
      {isLoading && <Loader />}
      <div className={fr.cx("fr-mb-2w")}>
        <Input
          label="Se rattacher à une entreprise"
          hintText="Rechercher par n° SIRET ou nom sous lequel il est enregistré sur Immersion Facilitée"
          nativeInputProps={{
            id: domElementIds.establishmentUserRegistration
              .registerEstablishmentSearch,
            type: "search",
            placeholder: "",
            value: inputValue,
            onChange: onEstablishmentSearchChange,
            onKeyDown: (event) => {
              if (event.key === "Escape") {
                establishmentSearchBySiretOrNameInput.current?.blur();
              }
            },
          }}
        />
      </div>
      <a
        href="https://annuaire-entreprises.data.gouv.fr/"
        target="_blank"
        rel="noreferrer"
        className={fr.cx("fr-link")}
      >
        <i className={fr.cx("fr-icon-information-fill", "fr-icon--sm")} />
        Retrouver votre siret sur l'Annuaire des Entreprises
      </a>
      {inputValue && (
        <div className={fr.cx("fr-mt-4w")}>
          <strong>
            {match(establishmentPublicOptionsLength)
              .with(1, () => `Résultat pour votre recherche "${inputValue}"`)
              .with(
                P.number.gte(2),
                () => `Résultats pour votre recherche "${inputValue}"`,
              )
              .otherwise(
                () =>
                  `Aucun résultat ne correspond à la recherche "${inputValue}"`,
              )}
          </strong>
          <p className={fr.cx("fr-hint-text")}>
            {match(establishmentPublicOptionsLength)
              .with(
                1,
                () => `${establishmentPublicOptionsLength} entreprise trouvée`,
              )
              .with(
                P.number.gte(2),
                () =>
                  `${establishmentPublicOptionsLength} entreprises trouvées`,
              )
              .otherwise(
                () =>
                  "Vous pouvez créer une nouvelle entreprise en suivant le bouton ci-dessous.",
              )}
          </p>
          <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
            {establishmentPublicOptions.map((establishmentPublicOption) => (
              <div
                className={fr.cx("fr-col-12", "fr-col-md-4")}
                key={establishmentPublicOption.siret}
              >
                <Card
                  title={
                    <div className={fr.cx("fr-grid-row--center")}>
                      <div className={fr.cx("fr-col-12")}>
                        {establishmentPublicOption.businessNameCustomized
                          ? establishmentPublicOption.businessNameCustomized
                          : establishmentPublicOption.businessName}
                      </div>
                      {establishmentPublicOption.isEstablishmentBanned && (
                        <div className={fr.cx("fr-col-12")}>
                          <Badge severity="error" small>
                            ENTREPRISE BANNIE
                          </Badge>
                        </div>
                      )}
                    </div>
                  }
                  desc={establishmentPublicOption.siret}
                  endDetail={
                    <Button
                      onClick={() => {
                        setSelectedEstablishmentSiret(
                          establishmentPublicOption.siret,
                        );
                        establishmentRegisterEstablishmentModal.open();
                      }}
                      size="small"
                      id={`${domElementIds.establishmentUserRegistration.registerEstablishmentButton}-${establishmentPublicOption.siret}`}
                      disabled={
                        establishmentPublicOption.isEstablishmentBanned ||
                        getStatusOnEstablishment(
                          establishmentPublicOption.siret,
                        ) !== undefined
                      }
                      className={fr.cx("fr-mt-auto")}
                    >
                      {match(
                        getStatusOnEstablishment(
                          establishmentPublicOption.siret,
                        ),
                      )
                        .with("PENDING", () => "Demande en cours")
                        .with("ACCEPTED", () => "Rattachement effectué")
                        .with(undefined, () => "Demander le rattachement")
                        .exhaustive()}
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
          {establishmentPublicOptions.length === 0 && (
            <Button
              linkProps={{
                href: `${frontRoutes.formEstablishment().href}`,
              }}
              className={fr.cx("fr-mt-2w")}
            >
              Créer une nouvelle entreprise
            </Button>
          )}
          {createPortal(
            <establishmentRegisterEstablishmentModal.Component
              title={"Demander le rattachement"}
            >
              <EstablishmentUserForm
                alreadyExistingUserRight={{
                  email: currentUser.email,
                  status: "PENDING",
                }}
                selectedEstablishmentSiret={selectedEstablishmentSiret}
                establishmentUsersEditModal={
                  establishmentRegisterEstablishmentModal
                }
              />
            </establishmentRegisterEstablishmentModal.Component>,
            document.body,
          )}
        </div>
      )}
    </>
  );
};
