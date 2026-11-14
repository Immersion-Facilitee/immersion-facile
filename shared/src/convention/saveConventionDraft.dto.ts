import { v4 as uuidV4 } from "uuid";
import type { AddressDto } from "../address/address.dto";
import type { Email } from "../email/email.dto";
import type { FtConnectIdentity } from "../federatedIdentities/federatedIdentity.dto";
import type { AppellationAndRomeDto } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { ScheduleDto } from "../schedule/Schedule.dto";
import type { OmitFromExistingKeys } from "../utils";
import type { InternshipKind, Renewed } from "./convention.dto";
import type { ConventionDraftId } from "./conventionDraftId";
import type { CreateConventionPresentationInitialValues } from "./conventionPresentation.dto";

type ConventionDeepPartial<T> = T extends
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Date
  | AddressDto
  | ScheduleDto
  | AppellationAndRomeDto
  | Renewed
  | FtConnectIdentity
  ? T
  : T extends object
    ? {
        [P in keyof T]?: ConventionDeepPartial<T[P]>;
      }
    : T;

export type ConventionDraftDto = ConventionDeepPartial<
  OmitFromExistingKeys<CreateConventionPresentationInitialValues, "id">
> & {
  id: ConventionDraftId;
  internshipKind: InternshipKind;
};

type WithConventionDraft = {
  conventionDraft: ConventionDraftDto;
};

export type SaveConventionDraftFromConventionDto = WithConventionDraft & {
  senderEmail: Email;
  mode: SaveConventionDraftMode;
  recipientEmail?: Email;
  details?: string;
};

export type SaveConventionDraftFromConventionTemplateDto =
  WithConventionDraft & {
    mode: SaveConventionDraftMode;
    recipientEmail: Email;
    details?: string;
  };

export type SaveConventionDraftMode = (typeof saveConventionDraftModes)[number];
export const saveConventionDraftModes = ["duplicate", "share"] as const;

export type SaveConventionDraftDto =
  | SaveConventionDraftFromConventionDto
  | SaveConventionDraftFromConventionTemplateDto
  | (WithConventionDraft & { mode: SaveConventionDraftMode });

export const toConventionDraftDto = ({
  convention,
}: {
  convention: CreateConventionPresentationInitialValues;
}): ConventionDraftDto => ({
  ...convention,
  id: convention.fromConventionDraftId ?? uuidV4(),
});
