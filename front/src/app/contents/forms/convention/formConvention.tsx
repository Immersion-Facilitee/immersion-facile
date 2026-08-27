import { keys, mergeRight } from "ramda";

import type { ReactNode } from "react";
import { domElementIds, type InternshipKind } from "shared";
import { useConventionTexts } from "src/app/contents/forms/convention/textSetup";
import type { ConventionField } from "../../admin/types";
import type { FormFieldAttributesForContent } from "../types";

export type FormFieldsObjectForContent<T> = Record<
  keyof T,
  FormFieldAttributesForContent
>;

// Remove and replace by ConventionField when postalCode is removed from ConventionDTO
type ConventionFieldWithoutPostalCode = Exclude<ConventionField, "postalCode">;

export type FormFieldKeys =
  | ConventionFieldWithoutPostalCode
  | "isCurrentEmployer"
  | "isEstablishmentTutorIsEstablishmentRepresentative"
  | "isMinor"
  | "agencyKind"
  | "name";

export type FormConventionFieldsLabels = FormFieldsObjectForContent<
  Record<FormFieldKeys, FormFieldAttributesForContent>
>;

const {
  conventionSection: conventionSectionIds,
  beneficiarySection: beneficiarySectionIds,
  establishmentTutorSection: establishmentTutorSectionIds,
  beneficiaryRepresentativeSection: beneficiaryRepresentativeSectionIds,
  beneficiaryCurrentEmployerSection: beneficiaryCurrentEmployerSectionIds,
  establishmentRepresentativeSection: establishmentRepresentativeSectionIds,
} = domElementIds.conventionImmersion;

export const formConventionFieldsLabels: (params: {
  internshipKind: InternshipKind;
  isConventionTemplate: boolean;
}) => FormConventionFieldsLabels = ({
  internshipKind,
  isConventionTemplate,
}) => ({
  ...conventionTemplateSection({ isConventionTemplate }),
  ...conventionSection({ internshipKind, isConventionTemplate }),
  ...beneficiarySection({ internshipKind, isConventionTemplate }),
  ...beneficiaryRepresentativeSection({ internshipKind, isConventionTemplate }),
  ...beneficiaryCurrentEmployerSection({ isConventionTemplate }),
  ...establishmentTutorSection({ internshipKind, isConventionTemplate }),
  ...establishmentRepresentativeSection({ isConventionTemplate }),

  //
  // TODO: exclude these fields from typing
  //
  ...fieldsToExclude,
});

const conventionTemplateSection = ({
  isConventionTemplate,
}: {
  isConventionTemplate: boolean;
}) => ({
  name: {
    label: "Nom du modèle",
    id: domElementIds.conventionTemplate.form.nameInput,
    required: isConventionTemplate,
  },
});

const conventionSection = ({
  internshipKind,
  isConventionTemplate,
}: {
  internshipKind: InternshipKind;
  isConventionTemplate: boolean;
}) => ({
  agencyDepartment: {
    label:
      internshipKind === "immersion"
        ? "Votre département"
        : "Saisissez le département de votre entreprise d’accueil",
    id: conventionSectionIds.agencyDepartment,
    required: !isConventionTemplate,
    placeholder: "Veuillez sélectionner un département",
  },
  agencyKind: {
    label: "Votre type de structure d'accompagnement",
    id: conventionSectionIds.agencyKind,
    required: false,
  },
  agencyId: {
    label:
      internshipKind === "immersion"
        ? "Votre structure d'accompagnement"
        : "Choisissez la Chambre consulaire correspondant à l'entreprise où se déroulera votre stage",
    id: conventionSectionIds.agencyId,
    required: !isConventionTemplate,
    hintText:
      internshipKind === "mini-stage-cci"
        ? "Choisissez votre organisme : Chambre d'agriculture (secteur agricole), CMA (alimentation, bâtiment, fabrication, services) ou CCI (commerce, services, industrie)."
        : undefined,
    placeholder:
      internshipKind === "immersion"
        ? "Veuillez sélectionner une structure d'accompagnement"
        : "Veuillez sélectionner un point orientation",
  },
  "agencyReferent.firstname": {
    label: "Prénom du conseiller",
    id: conventionSectionIds.agencyReferentFirstName,
    hintText:
      "Si vous la connaissez, indiquez la personne qui prescrit l’immersion (accompagnateur du candidat ou conseiller entreprise par exemple).",
  },
  "agencyReferent.lastname": {
    label: "Nom du conseiller",
    id: conventionSectionIds.agencyReferentLastName,
  },
  agencyRefersTo: {
    label: "Votre structure prescriptrice",
    id: "",
  },
  dateStart: {
    label:
      internshipKind === "immersion"
        ? "Date de début de l'immersion"
        : "Date de début du stage",
    id: conventionSectionIds.dateStart,
    required: !isConventionTemplate,
  },
  dateEnd: {
    label:
      internshipKind === "immersion"
        ? "Date de fin de l'immersion"
        : "Date de fin du stage",
    id: conventionSectionIds.dateEnd,
    required: !isConventionTemplate,
  },
  siret: {
    label: "SIRET",
    hintText:
      internshipKind === "immersion"
        ? "L'entreprise, le commerce ou encore l'association où l'immersion aura lieu. Format attendu : 362 521 879 00034"
        : "La structure d'accueil, où le candidat va faire son stage. Format attendu : 362 521 879 00034",
    id: conventionSectionIds.siret,
    required: !isConventionTemplate,
  },
  remoteWorkMode: {
    label: "Modalité de l'immersion",
    id: conventionSectionIds.remoteWorkMode,
    required: !isConventionTemplate,
  },
  businessName: {
    label: "Nom (raison sociale)",
    id: conventionSectionIds.businessName,
    required: !isConventionTemplate,
  },
  businessNameCustomized: {
    label: "Nom d'enseigne",
    hintText:
      "Indiquez le nom sous lequel l'entreprise souhaite apparaître s'il diffère de la raison sociale",
    id: conventionSectionIds.businessNameCustomized,
  },
  workConditions: {
    label:
      internshipKind === "immersion"
        ? "Conditions de travail, propres au métier observé pendant l’immersion "
        : "Conditions de travail, propres au métier observé pendant le stage ",
    hintText:
      "Ex : transport de marchandises longue distance pas de retour au domicile pendant 2 jours",
    id: conventionSectionIds.workConditions,
  },
  individualProtection: {
    label:
      internshipKind === "immersion"
        ? "Un équipement de protection individuelle est-il fourni pour l’immersion ?"
        : "Un équipement de protection individuelle est-il fourni pour le stage",
    id: conventionSectionIds.individualProtection,
    required: !isConventionTemplate,
  },
  individualProtectionDescription: {
    label: "Précisez le ou les équipement(s) :",
    hintText:
      "Ex : gants, gilets, combinaisons, chaussures, casques, harnais de sécurité, protections auditives, ...",
    id: conventionSectionIds.individualProtectionDescription,
  },
  sanitaryPrevention: {
    label:
      internshipKind === "immersion"
        ? "Des mesures de prévention sanitaire sont-elles prévues pour l’immersion ?"
        : "Des mesures de prévention sanitaire sont-elles prévues pour le stage ?",
    id: conventionSectionIds.sanitaryPrevention,
    required: !isConventionTemplate,
  },
  sanitaryPreventionDescription: {
    label: "Précisez les mesures de prévention sanitaire",
    hintText: "Ex : fourniture de gel, masques...",
    id: conventionSectionIds.sanitaryPreventionDescription,
  },
  immersionAddress: {
    label:
      internshipKind === "immersion"
        ? "Adresse du lieu où se fera l'immersion"
        : "Adresse du lieu où se fera le stage",
    id: conventionSectionIds.immersionAddress,
    hintText: "Ex : 35, Rue Édouard Danaux, 91220 Brétigny-sur-Orge",
    required: !isConventionTemplate,
  },
  immersionObjective: {
    label: "Objet de la période de mise en situation en milieu professionnel",
    id: conventionSectionIds.immersionObjective,
    required: !isConventionTemplate,
  },
  immersionAppellation: {
    label:
      internshipKind === "immersion"
        ? "Intitulé du poste / métier observé pendant l'immersion"
        : "Intitulé du métier observé pendant le stage",
    hintText: "Ex : employé libre service, web développeur, boulanger …",
    id: conventionSectionIds.immersionAppellation,
    required: !isConventionTemplate,
  },
  immersionActivities: {
    label:
      internshipKind === "immersion"
        ? "Activités observées / pratiquées pendant l'immersion"
        : "Activités observées / pratiquées pendant le stage",
    hintText:
      "Précisez les éléments-clés de la période, son contexte, les tâches confiées, les objectifs assignés au candidat.",
    id: conventionSectionIds.immersionActivities,
    required: !isConventionTemplate,
  },
  immersionSkills: {
    label:
      internshipKind === "immersion"
        ? "Compétences/aptitudes observées / évaluées pendant l'immersion"
        : "Compétences/aptitudes observées / évaluées pendant le stage",
    hintText:
      "Ex : communiquer à l’oral, résoudre des problèmes, travailler en équipe...",
    id: conventionSectionIds.immersionSkills,
  },
  isCurrentEmployer: {
    label:
      "Si la personne en immersion est actuellement salariée d'une entreprise, l'immersion va-t-elle se dérouler pendant le temps de travail habituel ?",
    id: conventionSectionIds.isCurrentEmployer,
    required: !isConventionTemplate,
    hintText: (
      <>
        <a
          href="https://immersion-facile.beta.gouv.fr/aide/article/est-il-possible-de-realiser-une-immersion-lorsque-lon-est-en-activite-1yb59te/"
          target="_blank"
          rel="noreferrer"
        >
          Dans quelles situations puis-je faire une immersion pendant mon temps
          de travail ?
        </a>
      </>
    ),
  },
  isEstablishmentTutorIsEstablishmentRepresentative: {
    label: `Qui sera le tuteur ${
      internshipKind === "immersion" ? "de l'immersion" : "du stage"
    } ?`,
    id: conventionSectionIds.isEstablishmentTutorIsEstablishmentRepresentative,
    required: !isConventionTemplate,
  },
  businessAdvantages: {
    label: "Avantages proposés par l'entreprise",
    id: conventionSectionIds.businessAdvantages,
    hintText:
      "Ex : navettes jusqu’au lieu de travail, paniers repas, hébergement...",
  },
  isMinor: {
    label: "La personne en immersion est-elle majeure protégée ?",
    id: conventionSectionIds.isMinor,
    required: !isConventionTemplate,
    hintText:
      "Les majeurs protégés sont les personnes qui sont dans l'impossibilité de pourvoir seules à leurs intérêts en raison de l'altération de leurs facultés mentales ou corporelles de nature à empêcher l'expression de leur volonté.",
  },
  "schedule.totalHours": {
    label: `Dates et horaires ${
      internshipKind === "immersion" ? "de l'immersion" : "du stage"
    }`,
  },
  schedule: {
    label: `Dates et horaires ${
      internshipKind === "immersion" ? "de l'immersion" : "du stage"
    }`,
    id: "",
  },
});

const beneficiarySection = ({
  internshipKind,
  isConventionTemplate,
}: {
  internshipKind: InternshipKind;
  isConventionTemplate: boolean;
}) => ({
  "signatories.beneficiary.firstName": {
    label: "Prénom",
    id: beneficiarySectionIds.firstName,
    required: !isConventionTemplate,
  },
  "signatories.beneficiary.lastName": {
    label: "Nom de famille",
    id: beneficiarySectionIds.lastName,
    required: !isConventionTemplate,
  },
  "signatories.beneficiary.birthdate": {
    label: "Date de naissance",
    hintText:
      "Merci d’indiquer la vraie date de naissance. Cette information est indispensable pour identifier la personne en immersion et traiter la convention. Une erreur ou une date volontairement différente peut empêcher la validation de la convention.",
    id: beneficiarySectionIds.birthdate,
    required: !isConventionTemplate,
  },
  "signatories.beneficiary.email": {
    label: "E-mail",
    id: beneficiarySectionIds.email,
    required: !isConventionTemplate,
    hintText: `Cette adresse email sera utilisée dans le cadre de la signature de la convention ${internshipKind === "immersion" ? "d'immersion" : "de stage"}. Pensez à bien vérifier son exactitude. Format attendu\u00A0: nom@exemple.com`,
  },
  "signatories.beneficiary.phone": {
    label: "Téléphone",
    hintText:
      internshipKind === "immersion"
        ? "Renseignez de préférence un téléphone portable pour pouvoir signer la convention par SMS. Format attendu : (+33) 6 22 33 44 55"
        : "Renseignez de préférence un téléphone portable pour pouvoir signer la convention de stage par SMS. Format attendu :  (+33) 6 22 33 44 55",
    id: beneficiarySectionIds.phone,
    required: !isConventionTemplate,
  },
  "signatories.beneficiary.levelOfEducation": {
    label: "Classe actuelle fréquentée par le candidat",
    id: beneficiarySectionIds.levelOfEducation,
    required: !isConventionTemplate,
    hintText: "Précisez votre statut",
  },
  "signatories.beneficiary.financiaryHelp": {
    label: "Aide matérielle",
    id: beneficiarySectionIds.financiaryHelp,
    hintText:
      "Le candidat a-t-il besoin d'une aide matérielle pour réaliser l'immersion ?",
  },
  "signatories.beneficiary.federatedIdentity": {
    // hidden field
    label: "",
    id: beneficiarySectionIds.federatedIdentity,
  },
  "signatories.beneficiary.emergencyContact": {
    label: "Prénom et nom de la personne à prévenir en cas d'urgence",
    id: beneficiarySectionIds.emergencyContact,
    hintText: "Ex : Jean Dupont",
  },
  "signatories.beneficiary.emergencyContactPhone": {
    label: "Téléphone de la personne à prévenir en cas d'urgence",
    id: beneficiarySectionIds.emergencyContactPhone,
    hintText: "Format attendu : (+33) 6 22 33 44 55",
  },
  "signatories.beneficiary.emergencyContactEmail": {
    label: "E-mail de la personne à prévenir en cas d'urgence",
    id: beneficiarySectionIds.emergencyContactEmail,
    hintText: "Format attendu\u00A0: nom@exemple.com",
  },
  "signatories.beneficiary.address": {
    label: "Adresse du candidat",
    id: beneficiarySectionIds.address,
    required: !isConventionTemplate,
  },
  "signatories.beneficiary.schoolName": {
    label: "Nom de l'établissement scolaire du candidat",
    id: beneficiarySectionIds.schoolName,
    required: !isConventionTemplate,
  },
  "signatories.beneficiary.schoolPostcode": {
    label: "Code postal de l'établissement scolaire du candidat",
    id: beneficiarySectionIds.schoolPostcode,
    required: !isConventionTemplate,
    hintText: "Ex : 06530",
  },
  "signatories.beneficiary.isRqth": {
    label:
      "La personne en immersion a-t-elle une reconnaissance travailleur handicapé (RQTH) ou équivalent\u00A0?",
    id: beneficiarySectionIds.isRqth,
    hintText: `Il n'est pas obligatoire de le préciser, mais cela peut être utile à la
        personne en ${internshipKind === "immersion" ? "immersion" : "stage"} et à l'entreprise.`,
  },
});

const establishmentTutorSection = ({
  isConventionTemplate,
}: {
  internshipKind: InternshipKind;
  isConventionTemplate: boolean;
}) => ({
  "establishmentTutor.firstName": {
    label: "Prénom du tuteur",
    hintText: "Ex : Alain",
    id: establishmentTutorSectionIds.firstName,
    required: !isConventionTemplate,
  },
  "establishmentTutor.lastName": {
    label: "Nom du tuteur",
    hintText: "Ex : Prost",
    id: establishmentTutorSectionIds.lastName,
    required: !isConventionTemplate,
  },
  "establishmentTutor.email": {
    label: "Email du tuteur",
    hintText:
      "Le tuteur recevra une copie de la convention et devra compléter le bilan via cette adresse email. Pensez à bien vérifier son exactitude. Ex: nom@entreprise.com",
    id: establishmentTutorSectionIds.email,
    required: !isConventionTemplate,
  },
  "establishmentTutor.phone": {
    label: "Numéro de téléphone du tuteur ou de l'entreprise",
    hintText:
      "Renseignez de préférence un téléphone portable afin de recevoir les rappels liés au bilan par SMS. Format attendu : 0605040302",
    id: establishmentTutorSectionIds.phone,
    required: !isConventionTemplate,
  },
  "establishmentTutor.job": {
    label: "Fonction du tuteur",
    hintText: "Ex : Pilote automobile",
    id: establishmentTutorSectionIds.job,
    required: !isConventionTemplate,
  },
});

const beneficiaryRepresentativeSection = ({
  internshipKind,
  isConventionTemplate,
}: {
  internshipKind: InternshipKind;
  isConventionTemplate: boolean;
}) => ({
  "signatories.beneficiaryRepresentative.firstName": {
    label: "Prénom du représentant légal",
    id: beneficiaryRepresentativeSectionIds.firstName,
    required: !isConventionTemplate,
  },
  "signatories.beneficiaryRepresentative.lastName": {
    label: "Nom de famille du représentant légal",
    id: beneficiaryRepresentativeSectionIds.lastName,
    required: !isConventionTemplate,
  },
  "signatories.beneficiaryRepresentative.email": {
    label: "Adresse email du représentant légal",
    id: beneficiaryRepresentativeSectionIds.email,
    hintText:
      "Cette adresse email sera utilisée dans le cadre de la signature de la convention. Pensez à bien vérifier son exactitude. Format attendu\u00A0: nom@exemple.com",
    required: !isConventionTemplate,
  },
  "signatories.beneficiaryRepresentative.phone": {
    label: "Téléphone du représentant légal",
    id: beneficiaryRepresentativeSectionIds.phone,
    hintText:
      internshipKind === "immersion"
        ? "Renseignez de préférence un téléphone portable pour pouvoir signer la convention par SMS. Format attendu : (+33) 6 22 33 44 55"
        : "Renseignez de préférence un téléphone portable pour pouvoir signer la convention de stage par SMS. Format attendu :  (+33) 6 22 33 44 55",
    required: !isConventionTemplate,
  },
});

const beneficiaryCurrentEmployerSection = ({
  isConventionTemplate,
}: {
  isConventionTemplate: boolean;
}) => ({
  "signatories.beneficiaryCurrentEmployer.businessName": {
    label: "Raison sociale de l'employeur actuel",
    id: beneficiaryCurrentEmployerSectionIds.businessName,
    required: !isConventionTemplate,
  },
  "signatories.beneficiaryCurrentEmployer.job": {
    label: "Fonction du signataire de l'employeur actuel",
    id: beneficiaryCurrentEmployerSectionIds.job,
  },
  "signatories.beneficiaryCurrentEmployer.email": {
    label: "E-mail du signataire de l'employeur actuel",
    id: beneficiaryCurrentEmployerSectionIds.email,
    required: !isConventionTemplate,
    hintText:
      "Cette adresse email sera utilisée dans le cadre de la signature de la convention. Pensez à bien vérifier son exactitude. Format attendu\u00A0: nom@exemple.com",
  },
  "signatories.beneficiaryCurrentEmployer.phone": {
    label: "Téléphone de l'employeur actuel",
    id: beneficiaryCurrentEmployerSectionIds.phone,
    required: !isConventionTemplate,
    hintText:
      "Renseignez de préférence un téléphone portable pour pouvoir signer la convention par SMS. Format attendu : (+33) 6 22 33 44 55",
  },
  "signatories.beneficiaryCurrentEmployer.firstName": {
    label: "Prénom du signataire de l'employeur actuel",
    id: beneficiaryCurrentEmployerSectionIds.firstName,
    required: !isConventionTemplate,
  },
  "signatories.beneficiaryCurrentEmployer.lastName": {
    label: "Nom de famille du signataire de l'employeur actuel",
    id: beneficiaryCurrentEmployerSectionIds.lastName,
    required: !isConventionTemplate,
  },
  "signatories.beneficiaryCurrentEmployer.businessSiret": {
    label: "SIRET de l'employeur actuel",
    id: beneficiaryCurrentEmployerSectionIds.businessSiret,
    required: !isConventionTemplate,
  },
  "signatories.beneficiaryCurrentEmployer.businessAddress": {
    label: "Adresse de l'employeur actuel",
    id: beneficiaryCurrentEmployerSectionIds.businessAddress,
    required: !isConventionTemplate,
  },
});

const establishmentRepresentativeSection = ({
  isConventionTemplate,
}: {
  isConventionTemplate: boolean;
}) => ({
  "signatories.establishmentRepresentative.firstName": {
    label: "Indiquez le prénom du représentant de l'entreprise",
    hintText: "Ex : Alain",
    id: establishmentRepresentativeSectionIds.firstName,
    required: !isConventionTemplate,
  },
  "signatories.establishmentRepresentative.lastName": {
    label: "Indiquez le nom du représentant de l'entreprise",
    hintText: "Ex : Prost",
    id: establishmentRepresentativeSectionIds.lastName,
    required: !isConventionTemplate,
  },
  "signatories.establishmentRepresentative.email": {
    label: "Indiquez l'e-mail du représentant de l'entreprise",
    hintText:
      "Cette adresse email sera utilisée dans le cadre de la signature de la convention. Pensez à bien vérifier son exactitude. Ex: nom@entreprise.com",
    id: establishmentRepresentativeSectionIds.email,
    required: !isConventionTemplate,
  },
  "signatories.establishmentRepresentative.phone": {
    label: "Indiquez le numéro de téléphone du représentant de l'entreprise",
    hintText:
      "Renseignez de préférence un téléphone portable pour signer la convention par SMS. Ex: 0605040302",
    id: establishmentRepresentativeSectionIds.phone,
    required: !isConventionTemplate,
  },
});

const fieldsToExclude = {
  agencyContactEmail: {
    label: "",
    id: "",
  },
  agencyValidationSteps: {
    label: "",
    id: "",
  },
  "agencyRefersTo.id": {
    label: "",
    id: "",
  },
  "agencyRefersTo.name": {
    label: "",
    id: "",
  },
  "agencyRefersTo.kind": {
    label: "",
    id: "",
  },
  "agencyRefersTo.contactEmail": {
    label: "",
    id: "",
  },
  "agencyRefersTo.siret": {
    label: "",
    id: "",
  },
  agencySiret: {
    label: "",
    id: "",
  },
  agencyName: {
    label: "",
    hintText: undefined,
    placeholder: undefined,
    id: "",
    required: undefined,
    autoComplete: undefined,
  },
  assessment: {
    label: "",
    id: "",
  },
  lastReminders: {
    label: "",
    id: "",
  },
  "establishmentTutor.role": {
    // to exclude
    label: "",
    id: "",
  },
  "signatories.beneficiary.signedAt": {
    // to exclude
    label: "",
    id: "",
  },
  "signatories.beneficiary.role": {
    // to exclude
    label: "",
    id: "",
  },
  signatories: {
    label: "",
    id: "",
  },

  establishmentTutor: {
    label: "",
    id: "",
  },
  agencyReferent: {
    label: "",
    id: "",
  },
  externalId: {
    label: "",
    id: "",
  },
  internshipKind: {
    label: "",
    id: "",
  },
  id: {
    label: "",
    id: "",
  },
  status: {
    label: "",
    id: "",
  },
  statusJustification: {
    label: "",
    id: "",
  },
  dateSubmission: {
    label: "",
    id: "",
  },
  updatedAt: {
    label: "",
    id: "",
  },
  "signatories.establishmentRepresentative.signedAt": {
    label: "",
    hintText: undefined,
    placeholder: undefined,
    id: "",
    required: undefined,
    autoComplete: undefined,
  },
  "signatories.establishmentRepresentative.role": {
    label: "",
    hintText: undefined,
    placeholder: undefined,
    id: "",
    required: undefined,
    autoComplete: undefined,
  },

  "signatories.beneficiaryCurrentEmployer.signedAt": {
    label: "",
    hintText: undefined,
    placeholder: undefined,
    id: "",
    required: undefined,
    autoComplete: undefined,
  },
  "signatories.beneficiaryCurrentEmployer.role": {
    label: "",
    hintText: undefined,
    placeholder: undefined,
    id: "",
    required: undefined,
    autoComplete: undefined,
  },
  "signatories.beneficiaryRepresentative.signedAt": {
    label: "",
    hintText: undefined,
    placeholder: undefined,
    id: "",
    required: undefined,
    autoComplete: undefined,
  },
  "signatories.beneficiaryRepresentative.role": {
    label: "",
    hintText: undefined,
    placeholder: undefined,
    id: "",
    required: undefined,
    autoComplete: undefined,
  },
  dateValidation: {
    label: "",
    hintText: undefined,
    placeholder: undefined,
    id: "",
    required: undefined,
    autoComplete: undefined,
  },
  dateApproval: {
    label: "",
    hintText: undefined,
    placeholder: undefined,
    id: "",
    required: undefined,
    autoComplete: undefined,
  },

  validators: {
    label: "",
    id: "",
  },
  renewed: {
    label: "",
    id: "",
  },
  "renewed.from": {
    label: "",
    id: "",
  },
  "renewed.justification": {
    label: "",
    id: "",
  },
  acquisitionKeyword: {
    label: "",
    id: "",
  },
  acquisitionCampaign: {
    label: "",
    id: "",
  },
  establishmentNumberEmployeesRange: {
    label: "",
    id: "",
  },
  isEstablishmentBanned: {
    label: "",
    id: "",
  },
  establishmentBannishmentJustification: {
    label: "",
    id: "",
  },
};

type SidebarStepContent = {
  title: string;
  description: ReactNode;
};

export const sidebarStepContent = (
  internshipKind: InternshipKind,
): SidebarStepContent[] => {
  const conventionTexts = useConventionTexts(internshipKind);
  const contents = {
    immersion: [
      {
        title: conventionTexts.agencySection.title,
        description: (
          <>
            <p>
              Cette étape vise à identifier la structure qui accompagne la
              personne en immersion dans son parcours. Cela permet de garantir
              un suivi et que celle-ci soit assurée pendant toute la durée de
              l’immersion.
            </p>
            <p>Pour toute question, n’hésitez pas à contacter le conseiller.</p>
          </>
        ),
      },
      {
        title: conventionTexts.beneficiarySection.title,
        description: (
          <>
            <p>
              Cette étape recueille les informations personnelles de la personne
              en immersion pour assurer le bon déroulement de l’immersion. Ces
              informations seront utilisées uniquement pour le suivi et la
              validation de la convention.
            </p>
            <p>
              Assurez-vous que les informations saisies sont exactes, car elles
              seront utilisées pour les communications concernant la convention
              et pour la validation auprès de l'entreprise.
            </p>
          </>
        ),
      },
      {
        title: conventionTexts.establishmentSection.title,
        description: (
          <>
            <p>
              L’objectif de cette étape est de fournir les informations
              nécessaires sur l'entreprise (ou collectivité, association, etc.)
              qui recevra la personne en immersion. Ces informations permettent
              de faciliter la signature de la convention par l'entreprise.
            </p>
            <p>
              Vérifiez les informations sur le tuteur, car il sera le point de
              contact principal pour l’organisation et la validation de
              l’immersion.
            </p>
          </>
        ),
      },
      {
        title: conventionTexts.immersionHourLocationSection.title,
        description: (
          <>
            <p>
              Définir précisément le lieu et les horaires de l’immersion permet
              de garantir la couverture de la personne en immersion pendant
              cette période.
            </p>

            <p>Pour toute question, contactez l'entreprise.</p>
          </>
        ),
      },
      {
        title: conventionTexts.immersionDetailsSection.title,
        description: (
          <>
            <p>
              Cette étape vise à préciser les tâches et activités prévues lors
              de l’immersion, afin de s’assurer que la personne en immersion
              tirera le meilleur parti de cette expérience.
            </p>
            <p>
              <strong>
                Consultez les{" "}
                <a
                  href="https://immersion-facile.beta.gouv.fr/aide/article/quelles-sont-les-obligations-a-respecter-pour-une-immersion-1bl944v/?bust=1690274462053"
                  rel="noreferrer"
                  target="_blank"
                >
                  conditions réglementaires
                </a>
                applicables aux immersions pour vous informer sur les exigences
                légales.
              </strong>
            </p>
          </>
        ),
      },
    ],
    "mini-stage-cci": [
      {
        title: conventionTexts.agencySection.title,
        description: (
          <>
            <p>
              Vérifiez que votre structure d’accompagnement est disponible dans
              la liste ci-dessous.{" "}
              <strong>
                Si ce n’est pas le cas, contactez votre conseiller.
              </strong>
            </p>
            <p>
              <strong>
                Si vous n'avez pas de structure d'accompagnement, retrouvez{" "}
                <a
                  href="https://immersion-facile.beta.gouv.fr/aide/article/je-nai-pas-de-structure-daccompagnement-et-je-veux-faire-une-immersion-1x15rdp/"
                  target="_blank"
                  rel="noreferrer"
                >
                  nos conseils ici
                </a>
                .
              </strong>
            </p>
          </>
        ),
      },
      {
        title: conventionTexts.beneficiarySection.title,
        description: (
          <>
            <p>
              Les informations de contact (email, téléphone) seront uniquement
              utilisées pour valider la convention avec l’entreprise et
              l’organisme d’accompagnement.
            </p>
            <p>
              <strong>
                Renseignez de préférence{" "}
                <strong>un numéro de téléphone portable</strong> pour recevoir
                les informations urgentes concernant la convention par SMS.
              </strong>
            </p>
          </>
        ),
      },
      {
        title: conventionTexts.establishmentSection.title,
        description: (
          <>
            <p>
              Les informations de contact (email, téléphone) seront uniquement
              utilisées pour valider la convention avec l’entreprise et
              l’organisme d’accompagnement.
            </p>
            <p>
              <strong>
                Renseignez de préférence{" "}
                <strong>un numéro de téléphone portable</strong> pour recevoir
                les informations urgentes concernant la convention par SMS.
              </strong>
            </p>
          </>
        ),
      },
      {
        title: conventionTexts.immersionHourLocationSection.title,
        description: <></>,
      },
      {
        title: conventionTexts.immersionDetailsSection.title,
        description: <></>,
      },
    ],
  };
  return contents[internshipKind];
};

export const makeFormUiSections = ({
  internshipKind,
  isConventionTemplate,
}: {
  internshipKind: InternshipKind;
  isConventionTemplate: boolean;
}): Partial<FormFieldKeys>[][] => [
  ["agencyId"],
  keys({
    ...beneficiarySection({
      internshipKind,
      isConventionTemplate,
    }),
    ...beneficiaryRepresentativeSection({
      internshipKind,
      isConventionTemplate,
    }),
    ...beneficiaryCurrentEmployerSection({ isConventionTemplate }),
  }),
  [
    ...keys(
      mergeRight(
        establishmentRepresentativeSection({ isConventionTemplate }),
        establishmentTutorSection({
          internshipKind,
          isConventionTemplate,
        }),
      ),
    ),
    "siret",
    "businessName",
    "businessNameCustomized",
  ],
  ["dateStart", "dateEnd", "schedule", "immersionAddress", "remoteWorkMode"],
  [
    "individualProtection",
    "sanitaryPrevention",
    "immersionObjective",
    "immersionAppellation",
    "immersionActivities",
  ],
];
