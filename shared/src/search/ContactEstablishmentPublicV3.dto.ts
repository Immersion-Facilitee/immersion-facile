import type { LocationId } from "../address/address.dto";
import type { ImmersionObjective } from "../convention/convention.dto";
import type {
  ContactLevelOfEducation,
  CreateDiscussionDto,
} from "../discussion/discussion.dto";
import type { Email } from "../email/email.dto";
import type { ContactMode } from "../formEstablishment/FormEstablishment.dto";
import type { AppellationCode } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { SiretDto } from "../siret/siret";
import type { Firstname, Lastname } from "../user/user.dto";

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
