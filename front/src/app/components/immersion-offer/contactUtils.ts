import type {
  AppellationCode,
  AppellationDto,
  CreateDiscussion1Eleve1StageDto,
  CreateDiscussionIFDto,
  DiscussionKind,
  ExcludeFromExisting,
} from "shared";

export const getDefaultAppellationCode = (
  appellations: AppellationDto[],
  appellationInParams: AppellationCode,
) => {
  if (appellationInParams) {
    return appellationInParams;
  }
  return appellations.length > 1 ? "" : appellations[0].appellationCode;
};

type ContactInputKeys = ExcludeFromExisting<
  keyof CreateDiscussionIFDto | keyof CreateDiscussion1Eleve1StageDto,
  | "kind"
  | "siret"
  | "contactMode"
  | "locationId"
  | "acquisitionCampaign"
  | "acquisitionKeyword"
  | "acquisitionMedium"
>;

export const makeContactInputsLabelsByKey = (
  kind: DiscussionKind,
): Record<ContactInputKeys, string> => ({
  immersionObjective: "But de l'immersion *",
  appellationCode: "Métier sur lequel porte la demande d'immersion *",
  datePreferences:
    kind === "IF"
      ? "Dates d'immersion envisagées *"
      : "Dates de stage envisagées *",
  potentialBeneficiaryFirstName: "Prénom *",
  potentialBeneficiaryLastName: "Nom *",
  potentialBeneficiaryEmail: "Email *",
  potentialBeneficiaryPhone: "Téléphone *",
  potentialBeneficiaryResumeLink: "Page LinkedIn ou CV en ligne (optionnel)",
  levelOfEducation: "Je suis en classe de ... *",
  experienceAdditionalInformation:
    "Détaillez en quelques lignes vos expériences et compétences (optionnel)",
});
