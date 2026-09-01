import type {
  AppellationCode,
  ContactLevelOfEducation,
  ContactMode,
  CreateDiscussionDto,
  Email,
  Firstname,
  ImmersionObjective,
  Lastname,
  LocationId,
  SiretDto,
} from "shared";

type ContactEstablishmentPublicV3CommonDto = {
  appellationCode: AppellationCode;
  siret: SiretDto;
  potentialBeneficiaryFirstName: Firstname;
  potentialBeneficiaryLastName: Lastname;
  potentialBeneficiaryEmail: Email;
  contactMode: ContactMode;
  locationId?: LocationId;
  acquisitionCampaign?: string;
  acquisitionKeyword?: string;
  potentialBeneficiaryPhone: string;
  datePreferences: string;
};

type ContactEstablishmentPublicV3IFDto =
  ContactEstablishmentPublicV3CommonDto & {
    kind: "IF";
    immersionObjective: ImmersionObjective;
    experienceAdditionalInformation?: string;
    potentialBeneficiaryResumeLink?: string;
  };

type ContactEstablishmentPublicV31Eleve1StageDto =
  ContactEstablishmentPublicV3CommonDto & {
    kind: "1_ELEVE_1_STAGE";
    levelOfEducation: ContactLevelOfEducation;
    immersionObjective: "Découvrir un métier ou un secteur d'activité";
  };

export type ContactEstablishmentPublicV3Dto =
  | ContactEstablishmentPublicV3IFDto
  | ContactEstablishmentPublicV31Eleve1StageDto;

export const contactEstablishmentPublicV3ToDomain = (
  contactRequest: ContactEstablishmentPublicV3Dto,
): CreateDiscussionDto =>
  contactRequest.kind === "IF"
    ? {
        ...contactRequest,
        motivation: "Non renseigné",
        immersionDuration: "flexible",
        experienceAdditionalInformation:
          contactRequest.experienceAdditionalInformation ?? "Non renseigné",
      }
    : contactRequest;
