import type { AbsoluteUrl } from "../AbsoluteUrl";
import type { WithAcquisition } from "../acquisition.dto";
import type { AddressAndPosition, LocationId } from "../address/address.dto";
import type { ApiConsumerName } from "../apiConsumer/ApiConsumer";
import type { Email } from "../email/email.dto";
import type { WithBannedEstablishmentInformations } from "../establishment/bannedEstablishmentInformations.dto";
import type {
  BusinessName,
  BusinessNameCustomized,
} from "../establishment/establishment.dto";
import type { GroupName } from "../group/group.dto";
import type { NafDto } from "../naf/naf.dto";
import type { PhoneNumber } from "../phone/phone.dto";
import type { WithRemoteWorkMode } from "../remoteWorkMode/remoteWorkMode.dto";
import type { EstablishmentRole } from "../role/role.dto";
import type { AppellationAndRomeDto } from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { SiretDto } from "../siret/siret";
import type { Flavor } from "../typeFlavors";
import { includesTypeGuard } from "../typeGuard";
import type { Firstname, Lastname } from "../user/user.dto";
import type { OmitFromExistingKeys } from "../utils";
import type { DateTimeIsoString } from "../utils/date";

export type ImmersionContactInEstablishmentId = Flavor<
  string,
  "ImmersionContactInEstablishmentId"
>;

export type EstablishmentFormOffer = AppellationAndRomeDto & WithRemoteWorkMode;

const contactModes = ["EMAIL", "PHONE", "IN_PERSON"] as const;
export type ContactMode = (typeof contactModes)[number];
export const isContactMode = includesTypeGuard(contactModes);

export const establishmentUserRightStatuses = ["ACCEPTED", "PENDING"] as const;

export type EstablishmentUserRightStatus =
  (typeof establishmentUserRightStatuses)[number];

type GenericFormEstablishmentUserRight<Role extends EstablishmentRole> = {
  firstName?: Firstname;
  lastName?: Lastname;
  email: Email;
  role: Role;
  status: EstablishmentUserRightStatus;
  shouldReceiveDiscussionNotifications: boolean;
};

type WithJob = {
  job?: string;
};

type WithPhone = {
  phone?: PhoneNumber;
  isMainContactByPhone?: boolean | null;
};

export type WithIsMainContactInPerson = {
  isMainContactInPerson?: boolean;
};

export type WithJobAndPhone = WithJob & WithPhone;

export type AdminFormEstablishmentUserRight =
  GenericFormEstablishmentUserRight<"establishment-admin"> &
    Required<WithJobAndPhone> &
    WithIsMainContactInPerson;

export type ContactFormEstablishmentUserRight =
  GenericFormEstablishmentUserRight<"establishment-contact"> &
    WithJobAndPhone &
    WithIsMainContactInPerson;

export type FormEstablishmentUserRight =
  | AdminFormEstablishmentUserRight
  | ContactFormEstablishmentUserRight;

type FormEstablishmentPendingUserRightAdmin = OmitFromExistingKeys<
  AdminFormEstablishmentUserRight,
  "status"
> & {
  status: "PENDING";
};

type FormEstablishmentPendingUserRightContact = OmitFromExistingKeys<
  ContactFormEstablishmentUserRight,
  "status"
> & {
  status: "PENDING";
};

export type FormEstablishmentPendingUserRight =
  | FormEstablishmentPendingUserRightAdmin
  | FormEstablishmentPendingUserRightContact;

export type FormEstablishmentSourceInUrl =
  | "immersion-facile"
  | "cci"
  | "cma"
  | "lesentreprises-sengagent"
  | "unJeuneUneSolution";

export type FormEstablishmentSource =
  | FormEstablishmentSourceInUrl
  | ApiConsumerName;

export type EstablishmentSearchableBy = {
  students: boolean;
  jobSeekers: boolean;
};

export type FormEstablishmentAddress = {
  id: LocationId;
  rawAddress: string;
};

export type EstablishmentSearchableByValue = keyof EstablishmentSearchableBy;

export type FitForDisableWorkerOption =
  (typeof fitForDisabledWorkersOptions)[number];

export const fitForDisabledWorkersPositiveOptions = [
  "yes-ft-certified",
  "yes-declared-only",
] as const;

export const fitForDisabledWorkersOptions = [
  ...fitForDisabledWorkersPositiveOptions,
  "no",
] as const;

export type EstablishmentWebSite = AbsoluteUrl | "";

export type CommonFormEstablishmentDto = {
  additionalInformation?: string;
  offers: EstablishmentFormOffer[];
  businessAddresses: FormEstablishmentAddress[];
  userRights: FormEstablishmentUserRight[];
  businessName: BusinessName;
  businessNameCustomized?: BusinessNameCustomized;
  fitForDisabledWorkers: FitForDisableWorkerOption;
  maxContactsPerMonth: number;
  naf?: NafDto;
  nextAvailabilityDate?: DateTimeIsoString;
  siret: SiretDto;
  source: FormEstablishmentSource;
  website?: EstablishmentWebSite;
  searchableBy: EstablishmentSearchableBy;
} & WithBannedEstablishmentInformations;

type GenericFormEstablishmentDto<T extends ContactMode> =
  CommonFormEstablishmentDto &
    WithAcquisition & {
      contactMode: T;
    } & (T extends "IN_PERSON"
      ? {
          potentialBeneficiaryWelcomeAddress: AddressAndPosition;
        }
      : {
          potentialBeneficiaryWelcomeAddress?: never;
        });

export type FormEstablishmentDto = GenericFormEstablishmentDto<
  "EMAIL" | "PHONE" | "IN_PERSON"
>;

export type WithFormEstablishmentDto = {
  formEstablishment: FormEstablishmentDto;
};

export type CSVBoolean = "1" | "0" | "";
export type CSVOptionalString = string | "";

export type EstablishmentCSVRow = {
  siret: string;
  businessNameCustomized: CSVOptionalString;
  businessName: string;
  businessAddress: string;
  naf_code: string;
  offers_appellation_code: string;
  contactMode: ContactMode;
  maxContactPerMonth?: CSVOptionalString;
  website: CSVOptionalString;
  additionalInformation: CSVOptionalString;
  fitForDisabledWorkers?: CSVBoolean;
  searchableByStudents: CSVBoolean;
  searchableByJobSeekers: CSVBoolean;
  right1_email: Email;
  right1_phone: PhoneNumber;
  right1_job: string;
  right2_role?: EstablishmentRole;
  right2_email?: Email;
  right2_phone?: PhoneNumber;
  right2_job?: string;
  right3_role?: EstablishmentRole;
  right3_email?: Email;
  right3_phone?: PhoneNumber;
  right3_job?: string;
  right4_role?: EstablishmentRole;
  right4_email?: Email;
  right4_phone?: PhoneNumber;
  right4_job?: string;
  right5_role?: EstablishmentRole;
  right5_email?: Email;
  right5_phone?: PhoneNumber;
  right5_job?: string;
  right6_role?: EstablishmentRole;
  right6_email?: Email;
  right6_phone?: PhoneNumber;
  right6_job?: string;
  right7_role?: EstablishmentRole;
  right7_email?: Email;
  right7_phone?: PhoneNumber;
  right7_job?: string;
  right8_role?: EstablishmentRole;
  right8_email?: Email;
  right8_phone?: PhoneNumber;
  right8_job?: string;
  right9_role?: EstablishmentRole;
  right9_email?: Email;
  right9_phone?: PhoneNumber;
  right9_job?: string;
  right10_role?: EstablishmentRole;
  right10_email?: Email;
  right10_phone?: PhoneNumber;
  right10_job?: string;
};

export type SiretAdditionFailure = { siret: SiretDto; errorMessage: string };

export type FormEstablishmentBatchDto = {
  groupName: GroupName;
  title: string;
  description: string;
  formEstablishments: FormEstablishmentDto[];
};

export type EstablishmentBatchReport = {
  numberOfEstablishmentsProcessed: number;
  numberOfSuccess: number;
  failures: SiretAdditionFailure[];
};

export type FormEstablishmentReadDto = Omit<
  FormEstablishmentDto,
  "contactMode"
> & {
  contactMode: ContactMode | null;
};
