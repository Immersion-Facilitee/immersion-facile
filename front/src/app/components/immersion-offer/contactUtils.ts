import type { DefaultValues } from "react-hook-form";
import {
  type AppellationCode,
  type AppellationDto,
  type CreateDiscussion1Eleve1StageDto,
  type CreateDiscussionDto,
  type CreateDiscussionIFDto,
  type DiscussionKind,
  discoverObjective,
  type ExcludeFromExisting,
} from "shared";
import type { ContactTranscientData } from "src/app/components/immersion-offer/useTranscientDataFromStorage";

export const getDefaultAppellationCode = (
  appellations: AppellationDto[],
  appellationInParams: AppellationCode,
) => {
  if (appellationInParams) {
    return appellationInParams;
  }
  return appellations.length > 1 ? "" : appellations[0].appellationCode;
};

export type ContactInputKeys = ExcludeFromExisting<
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
      ? "Dates ou période d'immersion envisagées *"
      : "Dates de stage envisagées *",
  immersionDuration: "Durée souhaitée *",
  motivation:
    "Pourquoi avoir choisi ce métier et/ou notre entreprise en particulier ? *",
  potentialBeneficiaryFirstName: "Prénom *",
  potentialBeneficiaryLastName: "Nom *",
  potentialBeneficiaryEmail: "Email *",
  potentialBeneficiaryPhone: "Téléphone *",
  potentialBeneficiaryResumeLink: "Page LinkedIn ou CV en ligne (optionnel)",
  levelOfEducation: "Je suis en classe de ... *",
  experienceAdditionalInformation:
    "L'immersion ne nécessite pas d'expérience spécifique. Quelles connaissances, expériences ou qualités personnelles souhaitez-vous partager pour aider l'entreprise à préparer votre accueil ? *",
});

export const makeCreateDiscussionValuesForKind = (
  kind: DiscussionKind,
  transcientData: ContactTranscientData | null,
): DefaultValues<CreateDiscussionDto> =>
  kind === "IF"
    ? {
        motivation: "",
        experienceAdditionalInformation: "",
        ...transcientData,
        kind: "IF",
      }
    : {
        levelOfEducation: "3ème",
        ...transcientData,
        kind: "1_ELEVE_1_STAGE",
        immersionObjective: discoverObjective,
      };
