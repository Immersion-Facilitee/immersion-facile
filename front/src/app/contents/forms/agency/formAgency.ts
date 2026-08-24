import {
  type AddressDto,
  type CreateAgencyDto,
  domElementIds,
  type GeoPositionDto,
} from "shared";
import type { FormFieldsObjectForContent } from "src/app/hooks/formContents.hooks";
import type { FormFieldAttributesForContent } from "../types";

export type FormAgencyFieldsLabels = FormFieldsObjectForContent<
  Record<
    Partial<
      | keyof CreateAgencyDto
      | "stepsForValidation"
      | `address.${keyof AddressDto}`
      | `position.${keyof GeoPositionDto}`
    >,
    FormFieldAttributesForContent
  >
>;

export const formAgencyFieldsLabels: FormAgencyFieldsLabels = {
  contactEmail: {
    label: "Adresse email à contacter en cas de besoin",
    id: domElementIds.addAgency.agencyContactEmailInput,
    placeholder: "contact@mail.com",
    required: true,
    hintText:
      "Cette adresse email sera affichée sur l’ensemble des conventions de la structure.",
  },
  id: {
    label: "Identifiant",
    id: domElementIds.addAgency.id,
  },
  name: {
    label: "Nom de la structure",
    placeholder: "Agence de Boulogne-Billancourt",
    required: true,
    id: domElementIds.addAgency.nameInput,
    autoComplete: "organization",
  },
  coveredDepartments: {
    id: domElementIds.addAgency.coveredDepartmentsInput,
    label: "Départements couverts",
  },
  address: {
    label: "Adresse de la structure",
    required: true,
    id: domElementIds.addAgency.addressInput.address,
    placeholder: "Ex: 26 rue du labrador, 37000 Tours",
  },
  "address.city": {
    label: "Ville",
    id: domElementIds.addAgency.addressInput.city,
  },
  "address.departmentCode": {
    label: "Code de département",
    id: domElementIds.addAgency.addressInput.departmentCode,
  },
  "address.postcode": {
    label: "Code postal",
    id: domElementIds.addAgency.addressInput.postcode,
  },
  "address.streetNumberAndAddress": {
    label: "Numéro et nom de rue",
    id: domElementIds.addAgency.addressInput.streetNumberAndAddress,
  },
  position: {
    label: "Coordonnées géographiques de la structure",
    id: domElementIds.addAgency.positionInput,
  },
  "position.lon": {
    label: "Coordonnées géographiques de la structure - longitude",
    id: domElementIds.addAgency.positionInput,
  },
  "position.lat": {
    label: "Coordonnées géographiques de la structure - latitude",
    id: domElementIds.addAgency.positionInput,
  },
  logoUrl: {
    label: "Téléverser le logo de votre structure",
    id: domElementIds.addAgency.logoUrlInput,
    hintText: "Cela permet de personnaliser les mails automatisés.",
  },
  validatorEmails: {
    required: true,
    id: domElementIds.addAgency.validatorEmailsInput,
    label: "Emails de validation définitive de la demande de convention",
    placeholder: "valideur.dupont@mail.com",
    hintText:
      "Les personnes ou emails génériques suivants valideront les conventions préalablement examinées.",
  },
  signature: {
    label: "Texte de signature",
    id: domElementIds.addAgency.signatureInput,
    required: true,
    hintText:
      "Quel texte de signature souhaitez-vous pour les mails automatisés ?",
    placeholder: "L’équipe de l’agence de Boulogne-Billancourt",
  },

  kind: {
    label: "Type de structure",
    id: domElementIds.addAgency.kindSelect,
    required: true,
    placeholder: "Veuillez choisir un type de structure",
  },
  counsellorEmails: {
    id: domElementIds.addAgency.counsellorEmailsInput,
    label: "Emails pour examen préalable de la demande de convention",
    placeholder: "Ex : conseiller.dupont@mail.com",
    hintText:
      "Les personnes ou emails génériques suivants recevront en premier les demandes de convention à examiner.",
  },
  agencySiret: {
    label: "SIRET de la structure",
    id: domElementIds.addAgency.agencySiretInput,
    placeholder: "n° de siret",
    required: true,
  },
  refersToAgencyId: {
    label: "Agence prescriptrice référente",
    id: domElementIds.addAgency.refersToAgencyId,
    required: true,
  },
  stepsForValidation: {
    id: domElementIds.addAgency.stepsForValidationInput,
    label: "Combien d'étapes de validation des immersions y a-t-il ?",
    required: true,
  },
  refersToAgencyName: {
    label: "",
    id: "",
  },
  createdAt: {
    label: "",
    id: "",
  },
  refersToAgencyContactEmail: { label: "", id: "" },
  acquisitionCampaign: {
    label: "",
    id: "",
  },
  acquisitionKeyword: {
    label: "",
    id: "",
  },
  acquisitionMedium: {
    label: "",
    id: "",
  },
  phoneNumber: {
    label: "Numéro de téléphone *",
    id: domElementIds.addAgency.phoneNumberInput,
    hintText:
      "Dans l'éventualité que nous vous contactions pour valider le référencement de votre structure, merci de nous indiquer votre numéro de téléphone",
  },
  delegationAgencyInfo: {
    label: "",
    id: "",
  },
};
