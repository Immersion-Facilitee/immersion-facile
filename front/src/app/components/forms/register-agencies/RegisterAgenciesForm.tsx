import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import Checkbox from "@codegouvfr/react-dsfr/Checkbox";
import Input from "@codegouvfr/react-dsfr/Input";
import {
  type ChangeEvent,
  type ElementRef,
  Fragment,
  useRef,
  useState,
} from "react";
import { Loader, ResponsiveTable, Tag } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AgencyId,
  type AgencyOption,
  agencyKindToLabelIncludingIFAndPrepa,
  type ConnectedUser,
  domElementIds,
  immersionFacileAgencyRegistrationHelpFormUrl,
  looksLikeSiret,
  type SiretDto,
} from "shared";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { agenciesSelectors } from "src/core-logic/domain/agencies/agencies.selectors";
import { agenciesSlice } from "src/core-logic/domain/agencies/agencies.slice";
import { connectedUserSlice } from "src/core-logic/domain/connected-user/connectedUser.slice";

export const RegisterAgenciesForm = ({
  currentUser,
}: {
  currentUser: ConnectedUser;
}) => {
  const dispatch = useDispatch();
  const [inputValue, setInputValue] = useState<SiretDto | undefined>(undefined);

  const agencySearchBySiretOrNameInput = useRef<ElementRef<"input">>(null);

  const [selectedAgencyIds, setSelectedAgencyIds] = useState<AgencyId[]>([]);

  const isFetching = useAppSelector(agenciesSelectors.isLoading);
  const feedback = useAppSelector(agenciesSelectors.feedback);
  const userAgencyIds = currentUser.agencyRights.map(
    (agencyRight) => agencyRight.agency.id,
  );
  const agencySearchResults = useAppSelector(agenciesSelectors.options).filter(
    (agency) => !userAgencyIds.includes(agency.id),
  );

  const onAgencySearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.currentTarget.value);
    setSelectedAgencyIds([]);
    dispatch(agenciesSlice.actions.clearFeedback());
    dispatch(
      agenciesSlice.actions.fetchAgencyOptionsRequested({
        [looksLikeSiret(event.currentTarget.value) ? "siret" : "nameIncludes"]:
          event.currentTarget.value,
        status: ["active", "from-api-PE"],
      }),
    );
  };

  if (
    inputValue === undefined &&
    currentUser.proConnect &&
    currentUser.agencyRights.length === 0
  ) {
    const siret = currentUser.proConnect.siret;
    setInputValue(siret);
    dispatch(
      agenciesSlice.actions.fetchAgencyOptionsRequested({
        siret,
        status: ["active", "from-api-PE"],
      }),
    );
  }

  return (
    <>
      {isFetching && <Loader />}
      <div className={fr.cx("fr-mt-4w", "fr-mb-2w")}>
        <Input
          label="Se rattacher à un organisme"
          hintText="Rechercher par n° SIRET ou nom sous lequel il est enregistré sur Immersion Facilitée"
          nativeInputProps={{
            id: domElementIds.agencyDashboard.registerAgencies.search,
            type: "search",
            placeholder: "",
            value: inputValue,
            onChange: onAgencySearchChange,
            onKeyDown: (event) => {
              if (event.key === "Escape") {
                agencySearchBySiretOrNameInput.current?.blur();
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

      {feedback.kind === "errored" && (
        <Alert
          severity="error"
          title="Une erreur est survenue"
          description="Les résultats de votre recherche n'ont pas pu être récupérés."
          className={fr.cx("fr-mt-2w")}
        />
      )}

      {inputValue && !isFetching && feedback.kind !== "errored" && (
        <>
          {agencySearchResults.length > 0 && (
            <AgencySearchWithResults
              inputValue={inputValue}
              selectedAgencyIds={selectedAgencyIds}
              setSelectedAgencyIds={setSelectedAgencyIds}
              agencies={agencySearchResults}
            />
          )}
          {agencySearchResults.length === 0 && (
            <AgencySearchNoResults inputValue={inputValue} />
          )}
        </>
      )}
    </>
  );
};

const AgencySearchNoResults = ({ inputValue }: { inputValue: string }) => (
  <>
    <p className={fr.cx("fr-mt-4w")}>
      <strong>
        Aucun organisme trouvé pour votre recherche "{inputValue}"
      </strong>
    </p>
    <CallOut
      iconId="fr-icon-info-line"
      title="Avant d'inscrire un nouvel organisme"
      buttonProps={{
        children: "Inscrire un nouvel organisme",
        id: domElementIds.agencyDashboard.registerAgencies.newAgencyButton,
        linkProps: {
          href: immersionFacileAgencyRegistrationHelpFormUrl,
          target: "_blank",
          rel: "noreferrer",
        },
      }}
    >
      <ol className={fr.cx("fr-text--md")}>
        <li>
          Essayez une autre méthode de recherche : par exemple, recherchez par
          nom de votre agence en commençant à taper quelques lettres à la place
          du numéro de SIRET.
        </li>
        <li>
          Si vous êtes certain·e que cet organisme n'existe pas encore sur la
          plateforme, inscrivez-le&nbsp;: vous pourrez valider ses conventions
          en ligne et accéder à ses statistiques.
        </li>
      </ol>
    </CallOut>
  </>
);

const AgencySearchWithResults = ({
  inputValue,
  selectedAgencyIds,
  setSelectedAgencyIds,
  agencies,
}: {
  inputValue: string;
  selectedAgencyIds: AgencyId[];
  setSelectedAgencyIds: (agencies: AgencyId[]) => void;
  agencies: AgencyOption[];
}) => {
  const dispatch = useDispatch();

  return (
    <>
      <section className={fr.cx("fr-mt-6w")}>
        <div className={fr.cx("fr-grid-row")}>
          <div className={fr.cx("fr-col-12", "fr-col-md")}>
            <strong>Résultats pour votre recherche "{inputValue}"</strong>

            <p className={fr.cx("fr-hint-text")}>
              {selectedAgencyIds.length}{" "}
              {selectedAgencyIds.length <= 1
                ? "organisme sélectionné"
                : "organismes sélectionnés"}
            </p>
          </div>
          <div className={fr.cx("fr-ml-md-auto")}>
            <Button
              className={fr.cx("fr-mb-2w")}
              id={domElementIds.agencyDashboard.registerAgencies.submitButton}
              priority="secondary"
              onClick={() => {
                dispatch(
                  connectedUserSlice.actions.registerAgenciesRequested({
                    agencies: selectedAgencyIds,
                    feedbackTopic: "agency-user-registration",
                  }),
                );
              }}
              disabled={selectedAgencyIds.length === 0}
            >
              Demander l'accès aux organismes sélectionnés
            </Button>
          </div>
        </div>
        <AgencyTable
          checkedAgencies={selectedAgencyIds}
          setCheckedAgencies={setSelectedAgencyIds}
          agencies={agencies}
        />
      </section>
      <section>
        <h2 className={fr.cx("fr-text--lead")}>
          Votre organisme ne fait pas partie de cette liste ?
        </h2>
        <ol className={fr.cx("fr-mt-2w")}>
          <li>
            Essayez une autre méthode de recherche : par exemple, recherchez par
            nom de votre agence en commençant à taper quelques lettres à la
            place du numéro de SIRET.
          </li>
          <li>
            Si les résultats ne correspondent toujours pas à votre besoin :{" "}
            <a
              id={domElementIds.agencyDashboard.registerAgencies.newAgencyLink}
              href={immersionFacileAgencyRegistrationHelpFormUrl}
              target="_blank"
              rel="noreferrer"
            >
              Inscrivez un nouvel organisme
            </a>
          </li>
        </ol>
      </section>
    </>
  );
};

const AgencyTable = ({
  checkedAgencies,
  setCheckedAgencies,
  agencies,
}: {
  checkedAgencies: AgencyId[];
  setCheckedAgencies: (agencies: AgencyId[]) => void;
  agencies: AgencyOption[];
}) => (
  <ResponsiveTable
    id={domElementIds.agencyDashboard.registerAgencies.table}
    headers={["", "Organismes"]}
    data={agencies.map((agency) => [
      <Checkbox
        key={`${agency.id}-checkbox`}
        options={[
          {
            label: "Sélectionner cet organisme",
            nativeInputProps: {
              checked: checkedAgencies.includes(agency.id),
              onChange: (event) => {
                const checked = event.currentTarget.checked;
                if (checked) {
                  setCheckedAgencies([...checkedAgencies, agency.id]);
                } else {
                  setCheckedAgencies(
                    checkedAgencies.filter((id) => id !== agency.id),
                  );
                }
              },
            },
          },
        ]}
      />,
      <Fragment key={`${agency.id}-infos`}>
        <Tag
          theme={
            agency.refersToAgencyName
              ? "structureAccompagnement"
              : "prescripteur"
          }
          label={`${
            agency.refersToAgencyName
              ? "Structure d'accompagnement"
              : "Prescripteur"
          } - ${agencyKindToLabelIncludingIFAndPrepa[agency.kind]}`}
        />
        <br />
        <strong>{agency.name}</strong>
        <br />
        <p>{agency.address.streetNumberAndAddress}</p>
      </Fragment>,
    ])}
  />
);
