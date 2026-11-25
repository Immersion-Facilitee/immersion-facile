import {
  domElementIds,
  type FormEstablishmentDto,
  type FormEstablishmentUserRight,
  immersionFacileContactEmail,
  type SiretDto,
} from "shared";
import type { FormFieldsObjectForContent } from "src/app/hooks/formContents.hooks";
import type { Mode } from "src/app/routes/routes.hooks";
import type { FormFieldAttributesForContent } from "../types";

type FormEstablishmentFieldKeys =
  | Exclude<keyof FormEstablishmentDto, "id" | "naf" | "source">
  | "maxContactsPerMonthWhenAvailable"
  | `userRights.0.${
      | keyof FormEstablishmentUserRight
      | "firstName"
      | "lastName"}`;

type FormEstablishmentField = Partial<FormEstablishmentFieldKeys>;

export type FormEstablishmentFieldsLabels = FormFieldsObjectForContent<
  Record<FormEstablishmentField, FormFieldAttributesForContent>
>;

export const formEstablishmentFieldsLabels = (
  mode: Mode,
): FormEstablishmentFieldsLabels => ({
  siret: {
    label: "Indiquez le SIRET de votre établissement",
    id: domElementIds.formEstablishment[mode].siret,
    hintText: "Format attendu : 123 456 789 01234",
    required: true,
  },
  businessName: {
    label: "Vérifiez le nom (raison sociale) de votre établissement",
    id: domElementIds.formEstablishment[mode].businessName,
    required: true,
  },
  businessNameCustomized: {
    label: "Nom affiché aux candidats",
    id: domElementIds.formEstablishment[mode].businessNameCustomized,
    autoComplete: "organization",
    hintText:
      "Nom sous lequel vous souhaitez apparaitre dans les résultats de recherche",
    placeholder: "Ex : Nom de mon enseigne (optionnel)",
  },
  businessAddresses: {
    label: "Les lieux où vous proposez une immersion",
    required: true,
    id: domElementIds.formEstablishment[mode].businessAddresses,
    placeholder: "Ex : 26 rue du labrador, 37000 Tours",
  },
  "userRights.0.firstName": {
    label: "Prénom de l'administrateur",
    hintText:
      "Ce champ est renseigné automatiquement depuis les données renseignées sur ProConnect",
    required: true,
    id: domElementIds.formEstablishment[mode].businessContact.firstName,
  },
  "userRights.0.lastName": {
    label: "Nom de l'administrateur",
    hintText:
      "Ce champ est renseigné automatiquement depuis les données renseignées sur ProConnect",
    required: true,
    id: domElementIds.formEstablishment[mode].businessContact.lastName,
  },
  "userRights.0.email": {
    label: "Email de l'administrateur",
    hintText:
      "Ce champ est renseigné automatiquement depuis les données renseignées sur ProConnect",
    required: true,
    id: domElementIds.formEstablishment[mode].businessContact.email,
  },
  "userRights.0.job": {
    label: "Fonction de l'administrateur",
    required: true,
    id: domElementIds.formEstablishment[mode].businessContact.job,
  },
  "userRights.0.phone": {
    label: "Numéro de téléphone de l'administrateur",
    hintText:
      "Renseignez de préférence un numéro de téléphone mobile. Exemple : 06 00 00 00 00",
    required: true,
    id: domElementIds.formEstablishment[mode].businessContact.phone,
  },
  "userRights.0.shouldReceiveDiscussionNotifications": {
    label: "Recevoir les notifications",
    required: true,
    id: domElementIds.formEstablishment[mode].businessContact
      .shouldReceiveDiscussionNotifications,
  },
  "userRights.0.role": {
    label: "",
    id: "",
  },
  "userRights.0.status": {
    label: "",
    id: "",
  },
  "userRights.0.isMainContactByPhone": {
    label: "Numéro de téléphone principal",
    id: domElementIds.formEstablishment[mode].businessContact
      .isMainContactByPhone,
  },
  "userRights.0.isMainContactInPerson": {
    label: "Contact principal en présentiel",
    id: domElementIds.formEstablishment[mode].businessContact
      .isMainContactInPerson,
  },
  userRights: {
    label: "Informations de l'administrateur",
    id: "not-used",
  },
  contactMode: {
    label: "Comment souhaitez-vous que les candidats vous contactent ?",
    required: true,
    id: domElementIds.formEstablishment[mode].contactMode,
  },
  fitForDisabledWorkers: {
    label:
      "Mon entreprise est prête à accueillir des personnes en situation de handicap",
    id: domElementIds.formEstablishment[mode].fitForDisabledWorkers,
  },
  offers: {
    label: "Les métiers que vous proposez à l'immersion",
    hintText:
      "Chaque métier correspond à une offre qui apparaitra dans la recherche. Votre établissement peut donc apparaître dans différentes recherches.",
    id: domElementIds.formEstablishment[mode].appellations,
    required: true,
  },
  website: {
    label: "URL vers votre site internet",
    id: domElementIds.formEstablishment[mode].website,
    placeholder: "Ex : https://mon-site-internet.fr (optionnel)",
  },
  additionalInformation: {
    label: "À propos de votre entreprise",
    id: domElementIds.formEstablishment[mode].additionalInformation,
    hintText:
      "Nous vous conseillons de valoriser votre histoire afin de donner envie à un candidat de découvrir un métier au sein de votre établissement.",
    placeholder:
      "Ex : ma biographie d’entreprise (valeurs, écosystème, projections), mon potentiel d’embauche ou toute autre information essentielle pour l’accueil du bénéficiaire au sein de mon établissement (optionnel)",
  },
  maxContactsPerMonth: {
    label:
      "Au maximum, combien de candidatures souhaitez-vous recevoir par mois ?",
    hintText:
      "Ce chiffre correspond au nombre total de mises en relation reçues pour toutes vos offres. Exemple : si vous proposez 2 métiers et indiquez 8 mises en relation par mois, vous recevrez en tout 8 mises en relation (et non 16), réparties sur vos métiers.",
    id: domElementIds.formEstablishment[mode].maxContactsPerMonth,
  },
  maxContactsPerMonthWhenAvailable: {
    label:
      "Quand vous serez à nouveau disponible, combien de candidatures par mois souhaiteriez-vous recevoir ?",
    hintText:
      "Par exemple, en renseignant 5 : si vous avez déjà reçu 5 demandes ce mois, vous n'apparaîtrez plus dans la liste des entreprises accueillantes jusqu'au mois suivant.",
    id: domElementIds.formEstablishment[mode].maxContactsPerMonthWhenAvailable,
  },
  nextAvailabilityDate: {
    label: "Quand serez-vous à nouveau disponible ?",
    id: domElementIds.formEstablishment[mode].nextAvailabilityDateInput,
  },
  searchableBy: {
    label: "Qui souhaitez-vous accueillir en immersion ?",
    id: domElementIds.formEstablishment[mode].searchableBy,
  },
  acquisitionKeyword: {
    label: "",
    id: "",
  },
  acquisitionCampaign: {
    label: "",
    id: "",
  },
  acquisitionMedium: {
    label: "",
    id: "",
  },
  potentialBeneficiaryWelcomeAddress: {
    label: "Adresse d'accueil pour les candidats",
    id: domElementIds.formEstablishment[mode]
      .potentialBeneficiaryWelcomeAddress,
  },
  isEstablishmentBanned: { label: "", id: "" },
});

export type EstablishmentEditTab = "offers" | "informations";

export const establishmentEditTabsLabels: Record<EstablishmentEditTab, string> =
  {
    offers: "Offres",
    informations: "Informations de l'entreprise",
  };

export const establishmentEditSubmitLabel = "Enregistrer les modifications";

export const establishmentCreationConfirmationContent = {
  title: "Votre entreprise a bien été inscrite",
  visibility: ({
    establishmentName,
    availableFrom,
  }: {
    establishmentName: string;
    availableFrom: string | null;
  }): string =>
    `${establishmentName} ${availableFrom ? `apparaîtra à partir du ${availableFrom}` : "apparaît dès maintenant"} dans la recherche d'Immersion Facilitée.`,
  superEstablishmentTitle:
    "Vous souhaitez apparaître dans les premiers résultats ?",
  superEstablishmentDescription:
    "Obtenez la reconnaissance « Super entreprise » en étant répondant aux demandes, en accueillant des immersions et en maintenant votre profil à jour.",
  addOtherOfferLabel: "Ajouter une autre offre",
  seeEstablishmentLabel: "Voir ma fiche entreprise",
};

export const establishmentOfferPageContent = {
  title: "Ajouter / modifier une offre",
  subtitle: (businessName: string): string => `Pour ${businessName}.`,
};

export const deleteOfferModalContent = {
  title: "Supprimer ce métier ?",
  cancelLabel: "Annuler",
  confirmLabel: "Supprimer",
  description: (appellationLabel: string | undefined): string =>
    `Le métier « ${appellationLabel} » sera supprimé de votre fiche entreprise et n'apparaîtra plus dans la recherche.`,
};

export const firstOfferIntro =
  "Elle apparaîtra dans la recherche. Vous pourrez ajouter d'autres offres une fois l'inscription terminée.";

export const businessAddressesDescription =
  "Par défaut, vous apparaîtrez dans les résultats de recherche liés à l’adresse de votre établissement. Vous pouvez ajouter d’autres adresses si vous proposez des immersions ailleurs. Par exemple : votre société est située à Dijon (adresse liée à votre SIRET) mais vous proposez une immersion dans votre antenne de Nantes.";

export const mailtoHref = (siret: SiretDto) => {
  const lineBreak = "%0D%0A";
  const deleteEstablishmentSubject = "Demande de suppression d'entreprise";
  const deleteEstablishmentBody = (siret: SiretDto) =>
    `Bonjour,${lineBreak}Je souhaite supprimer les données de mon entreprise dont le numéro de SIRET est ${siret}.${lineBreak}Cordialement.`;

  return `mailto:${immersionFacileContactEmail}?subject=${deleteEstablishmentSubject}&body=${deleteEstablishmentBody(
    siret,
  )}`;
};
