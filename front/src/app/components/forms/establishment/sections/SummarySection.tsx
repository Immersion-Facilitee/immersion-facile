import { fr } from "@codegouvfr/react-dsfr";
import type { ButtonProps } from "@codegouvfr/react-dsfr/Button";
import ButtonsGroup from "@codegouvfr/react-dsfr/ButtonsGroup";
import { HeadingSection, Loader, SectionHighlight } from "react-design-system";
import { useFormContext } from "react-hook-form";
import {
  addressDtoToString,
  type ContactMode,
  domElementIds,
  type FederatedIdentity,
  type FormEstablishmentDto,
  getFormattedFirstnameAndLastname,
  remoteWorkModeLabels,
  toDisplayedPhoneNumber,
} from "shared";
import type {
  OnStepChange,
  Step,
} from "src/app/components/forms/establishment/EstablishmentForm";
import { SearchResultPreview } from "src/app/components/forms/establishment/SearchResultPreview";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import type { Mode } from "src/app/routes/routes.hooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";

export const SummarySection = ({
  mode,
  onStepChange,
  isEstablishmentAdmin,
}: {
  currentStep: Step;
  mode: Mode;
  onStepChange: OnStepChange;
  isEstablishmentAdmin: boolean;
}) => {
  const {
    getValues,
    formState: { isSubmitting },
  } = useFormContext<FormEstablishmentDto>();
  const formValues = getValues();
  const federatedIdentity = useAppSelector(authSelectors.federatedIdentity);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);

  const buttons: [ButtonProps, ...ButtonProps[]] = [
    {
      children: "Étape précédente",
      iconId: "fr-icon-arrow-left-line",
      priority: "secondary",
      type: "button",
      id: domElementIds.formEstablishment[mode].previousButtonFromStepAndMode({
        currentStep: 3,
        mode,
      }),
      onClick: () => onStepChange(3, []),
    },
    {
      children: isEstablishmentAdmin
        ? "Enregistrer les modifications"
        : "Valider et créer l'entreprise",
      iconId: "fr-icon-checkbox-circle-line",
      iconPosition: "right",
      type: "submit",
      disabled: isSubmitting,
      id: domElementIds.formEstablishment[mode].submitFormButton,
    },
  ];

  if (!currentUser) return <Loader />;

  const formatedUserName = getFormattedFirstnameAndLastname({
    firstname: currentUser.firstName,
    lastname: currentUser.lastName,
  });

  return (
    <>
      <p>
        Voici un récapitulatif des informations saisies pour l’entreprise{" "}
        {formValues.businessName} (SIRET :{" "}
        <strong id={domElementIds.formEstablishment.create.summarySiretValue}>
          {formValues.siret}
        </strong>
        ). L’administrateur sera :{" "}
        <strong>
          {federatedIdentity?.provider === "proConnect" && (
            <span id={domElementIds.formEstablishment.create.summaryAdminName}>
              {formatedUserName}
              {" - "}
            </span>
          )}
          {formValues.userRights[0].email}
        </strong>
      </p>
      <HeadingSection
        title="Lieux et métiers référencés"
        description="Ces éléments apparaîtront dans la recherche d’entreprises accueillantes. Votre entreprise peut donc apparaître dans différentes recherches."
      >
        <SectionHighlight>
          {formValues.offers.filter(
            (offer) => offer.remoteWorkMode !== "FULL_REMOTE",
          ).length > 0 && (
            <>
              <p className={fr.cx("fr-text--bold", "fr-mb-0")}>
                Adresses d'accueil :
              </p>
              <ul
                id={
                  domElementIds.formEstablishment.create
                    .summaryBusinessAddresses
                }
              >
                {formValues.businessAddresses.map((businessAddress) => (
                  <li key={businessAddress.id}>{businessAddress.rawAddress}</li>
                ))}
              </ul>
            </>
          )}
          <p className={fr.cx("fr-text--bold", "fr-mb-0")}>
            Métiers proposés :
          </p>
          <ul id={domElementIds.formEstablishment.create.summaryAppellations}>
            {formValues.offers.map((offer) => (
              <li key={offer.appellationCode}>
                {offer.appellationLabel} -{" "}
                {remoteWorkModeLabels[offer.remoteWorkMode].label}
              </li>
            ))}
          </ul>
        </SectionHighlight>
      </HeadingSection>
      <HeadingSection title="Paramètres de vos offres">
        <SectionHighlight>
          <p className={fr.cx("fr-text--bold", "fr-mb-0")}>Disponibilité :</p>
          <p>
            L’entreprise sera visible dans l’annuaire, avec un maximum de{" "}
            {formValues.maxContactsPerMonth} candidatures par mois
          </p>

          <p className={fr.cx("fr-text--bold", "fr-mb-0")}>
            Type de candidats :
          </p>
          <p>
            <DisplaySearchableByValue searchableBy={formValues.searchableBy} />
          </p>

          <p className={fr.cx("fr-text--bold", "fr-mb-0")}>
            Moyen de contact :
          </p>
          <DisplayContactModeValue
            contactMode={formValues.contactMode}
            federatedIdentity={federatedIdentity}
            formatedUserName={formatedUserName}
          />
        </SectionHighlight>
      </HeadingSection>
      <HeadingSection
        title="Prévisualisation de votre entreprise"
        description="Cette prévisualisation est donnée à titre indicatif. Elle affiche un exemple parmi les métiers et lieux que vous avez renseignés."
      >
        <SearchResultPreview establishment={formValues} />
      </HeadingSection>
      <ButtonsGroup
        buttons={buttons}
        inlineLayoutWhen="always"
        alignment="left"
      />
    </>
  );
};

const DisplaySearchableByValue = ({
  searchableBy: { jobSeekers, students },
}: {
  searchableBy: FormEstablishmentDto["searchableBy"];
}) => {
  if (!students) {
    return <div>Public non scolaire</div>;
  }
  if (!jobSeekers) {
    return <div>Public scolaire</div>;
  }
  return <div>Tout le monde (public scolaire et non scolaire)</div>;
};

const DisplayContactModeValue = ({
  contactMode,
  federatedIdentity,
  formatedUserName,
}: {
  contactMode: ContactMode;
  federatedIdentity: FederatedIdentity | null;
  formatedUserName: string;
}) => {
  const { getValues } = useFormContext<FormEstablishmentDto>();
  const formValues = getValues();
  const contactModeLabels: Record<ContactMode, string> = {
    EMAIL: "Par email",
    PHONE: "Par téléphone",
    IN_PERSON: "En présentiel",
  };
  return (
    <div className={fr.cx("fr-mt-1w")}>
      {contactModeLabels[contactMode]}
      {contactMode === "IN_PERSON" &&
        formValues.potentialBeneficiaryWelcomeAddress && (
          <p>
            Lieu de rendez-vous :{" "}
            {addressDtoToString(
              formValues.potentialBeneficiaryWelcomeAddress.address,
            )}
            <br />
            {formValues.userRights[0].isMainContactInPerson &&
              federatedIdentity?.provider === "proConnect" && (
                <>Contact principal en présentiel : {formatedUserName}</>
              )}
          </p>
        )}
      {contactMode === "PHONE" && (
        <p>
          Contact principal par téléphone :{" "}
          {`${formValues.userRights[0].phone ? toDisplayedPhoneNumber(formValues.userRights[0].phone) : ""}${
            federatedIdentity?.provider === "proConnect"
              ? ` (${formatedUserName})`
              : ""
          }`}
        </p>
      )}
      {contactMode === "EMAIL" && (
        <p>
          Contact principal par email : {formValues.userRights[0].email}
          <br />
          En cas non-réponse de l'entreprise au bout de 15 jours,{" "}
          <strong>
            {formValues.userRights[0].isMainContactByPhone
              ? `le candidat peut contacter l'entreprise au numéro de téléphone : ${
                  formValues.userRights[0].phone
                    ? toDisplayedPhoneNumber(formValues.userRights[0].phone)
                    : ""
                }${
                  federatedIdentity?.provider === "proConnect"
                    ? ` (${formatedUserName})`
                    : ""
                }`
              : "le candidat ne peut pas contacter l'entreprise"}
          </strong>
        </p>
      )}
    </div>
  );
};
