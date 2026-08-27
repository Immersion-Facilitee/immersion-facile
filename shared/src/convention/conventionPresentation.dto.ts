import type { OmitFromExistingKeys } from "../utils";
import type {
  ConventionReadDto,
  EstablishmentTutor,
  InternshipKind,
  Signatories,
} from "./convention.dto";
import type { ConventionDraftId } from "./conventionDraftId";
import type { ConventionTemplateId } from "./conventionTemplate.dto";
import type { ConventionDraftDto } from "./saveConventionDraft.dto";

export const undefinedIfEmptyString = (text?: string): string | undefined =>
  text || undefined;

type WithSignatures = {
  signatories: {
    [K in keyof Signatories]: Partial<Signatories[K]>;
  };
};

type WithEstablishmentTutor = {
  establishmentTutor: EstablishmentTutor;
};

type WithIntershipKind = {
  internshipKind: InternshipKind;
};

type WithFromFtConnectedUser = {
  fromFtConnectedUser?: boolean;
};

export type CreateConventionTemplatePresentationInitialValues =
  OmitFromExistingKeys<ConventionDraftDto, "id"> & {
    id: ConventionTemplateId;
    name: string;
  };

export type ConventionFormInitialValues =
  | CreateConventionPresentationInitialValues
  | CreateConventionTemplatePresentationInitialValues;

export const isCreateConventionPresentationInitialValues = (
  v: ConventionFormInitialValues,
): v is CreateConventionPresentationInitialValues => !("name" in v);

export type CreateConventionPresentationInitialValues = OmitFromExistingKeys<
  Partial<ConventionReadDto>,
  "agencyName" | "agencySiret" | "agencyValidationSteps"
> &
  Partial<WithFromConventionDraftId> &
  WithSignatures &
  WithEstablishmentTutor &
  WithIntershipKind &
  WithFromFtConnectedUser;

export type WithFromConventionDraftId = {
  fromConventionDraftId: ConventionDraftId;
};

export type ConventionPresentation = OmitFromExistingKeys<
  ConventionReadDto,
  | "agencyKind"
  | "agencyName"
  | "agencySiret"
  | "agencyContactEmail"
  | "assessment"
  | "agencyValidationSteps"
> &
  Partial<WithFromConventionDraftId> &
  WithSignatures &
  WithFromFtConnectedUser;

export type WithStatusJustification = {
  statusJustification: string;
};
