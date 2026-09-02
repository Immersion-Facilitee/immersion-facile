import type { AbsoluteUrl } from "../AbsoluteUrl";
import type { WithAcquisition } from "../acquisition.dto";
import type { AddressDto, LocationId } from "../address/address.dto";
import type {
  ConventionId,
  discoverObjective,
  ImmersionObjective,
  LevelOfEducation,
} from "../convention/convention.dto";
import type { Email } from "../email/email.dto";
import type { WithBannedEstablishmentInformations } from "../establishment/bannedEstablishmentInformations.dto";
import type {
  BusinessName,
  WithPhoneContactAdditionalCondition,
} from "../establishment/establishment.dto";
import type { ContactMode } from "../formEstablishment/FormEstablishment.dto";
import type { PhoneNumber } from "../phone/phone.dto";
import type {
  AppellationAndRomeDto,
  AppellationCode,
} from "../romeAndAppellationDtos/romeAndAppellation.dto";
import type { SearchTextAlphaNumeric } from "../search/searchText.schema";
import type { SiretDto } from "../siret/siret";
import type { ConnectedUserJwt } from "../tokens/jwt.dto";
import type { Flavor } from "../typeFlavors";
import type { Firstname, Lastname } from "../user/user.dto";
import type { ExtractFromExisting, OmitFromExistingKeys } from "../utils";
import type { DateString } from "../utils/date";
import type {
  discussionExchangeForbiddenReasons,
  exchangeRoles,
} from "./discussion.schema";

export const candidateWarnedMethods = [
  "phone",
  "email",
  "inPerson",
  "other",
] as const;

export type CandidateWarnedMethod = (typeof candidateWarnedMethods)[number];

export type ExchangeRole = (typeof exchangeRoles)[number];

export type WithUserRole = {
  userRole: ExchangeRole;
};

export type DiscussionExchangeForbiddenReason =
  (typeof discussionExchangeForbiddenReasons)[number];

type DiscussionExchangeForbiddenParamsWithoutRequestEstablishmentRegistrationUrl =
  {
    reason: Exclude<
      DiscussionExchangeForbiddenReason,
      "user_unknown_or_missing_rights_on_establishment"
    >;
    sender: ExchangeRole;
  };

export type DiscussionExchangeForbiddenParamsWithRequestEstablishmentRegistrationUrl =
  {
    reason: "user_unknown_or_missing_rights_on_establishment";
    sender: ExchangeRole;
    requestEstablishmentRegistrationUrl: AbsoluteUrl;
  };

export type DiscussionExchangeForbiddenParams = (
  | DiscussionExchangeForbiddenParamsWithoutRequestEstablishmentRegistrationUrl
  | DiscussionExchangeForbiddenParamsWithRequestEstablishmentRegistrationUrl
) & {
  establishmentName?: string;
};

export type DiscussionId = Flavor<string, "DiscussionId">;
export type WithDiscussionId = {
  discussionId: DiscussionId;
};

export type DiscussionKind = "IF" | "1_ELEVE_1_STAGE";

export type WithDiscussionMessage = {
  message: Message;
};

export type SendMessageToDiscussionFromDashboardRequestPayload = {
  discussionId: DiscussionId;
  jwt: ConnectedUserJwt;
} & ExchangeFromDashboard;

export const contactLevelsOfEducation = [
  "3ème",
  "2nde",
] as const satisfies Extract<LevelOfEducation, "3ème" | "2nde">[];

export type ContactLevelOfEducation = (typeof contactLevelsOfEducation)[number];

export const labelsForContactLevelOfEducation: Record<
  ContactLevelOfEducation,
  string
> = {
  "3ème": "Troisième",
  "2nde": "Seconde",
};

export const immersionDurations = [
  "lessThanOneWeek",
  "oneWeek",
  "twoWeeksOrMore",
  "flexible",
] as const;

export type ImmersionDuration = (typeof immersionDurations)[number];

export const immersionDurationLabels: Record<ImmersionDuration, string> = {
  lessThanOneWeek: "Moins d'une semaine",
  oneWeek: "1 semaine",
  twoWeeksOrMore: "2 semaines ou plus",
  flexible: "Je suis flexible",
};

type ContactInformations<D extends DiscussionKind> = {
  appellationCode: AppellationCode;
  siret: SiretDto;
  potentialBeneficiaryFirstName: Firstname;
  potentialBeneficiaryLastName: Lastname;
  potentialBeneficiaryEmail: Email;
  contactMode: ContactMode;
  kind: D;
  locationId?: LocationId;
} & WithAcquisition &
  (D extends "1_ELEVE_1_STAGE"
    ? { levelOfEducation: ContactLevelOfEducation }
    : // biome-ignore lint/complexity/noBannedTypes: we need {} here
      {});

type CreateDiscussionDtoCommon = {
  potentialBeneficiaryPhone: string;
  datePreferences: string;
};

export type CreateDiscussionIFDto = ContactInformations<"IF"> &
  CreateDiscussionDtoCommon & {
    immersionObjective: ImmersionObjective;
    immersionDuration: ImmersionDuration;
    motivation: string;
    experienceAdditionalInformation: string;
    potentialBeneficiaryResumeLink?: string;
  };

export type CreateDiscussion1Eleve1StageDto =
  ContactInformations<"1_ELEVE_1_STAGE"> &
    CreateDiscussionDtoCommon & {
      immersionObjective: Extract<ImmersionObjective, typeof discoverObjective>;
    };

export type CreateDiscussionDto =
  | CreateDiscussionIFDto
  | CreateDiscussion1Eleve1StageDto;

export type ContactEstablishmentEventPayload = {
  discussionId: DiscussionId;
  siret: SiretDto;
  isLegacy?: boolean;
};

type WithDiscussionKindProps<D extends DiscussionKind> = D extends "IF"
  ? {
      resumeLink?: string;
      motivation: string;
      immersionDuration: ImmersionDuration;
      experienceAdditionalInformation: string;
      immersionObjective: ImmersionObjective | null;
    }
  : {
      levelOfEducation: ContactLevelOfEducation;
      immersionObjective: Extract<ImmersionObjective, typeof discoverObjective>;
    };

export type PotentialBeneficiaryCommonProps = {
  email: Email;
  firstName: Firstname;
  lastName: Lastname;
  datePreferences: string;
  phone: PhoneNumber;
};

type DiscussionPotentialBeneficiary<D extends DiscussionKind> =
  PotentialBeneficiaryCommonProps & WithDiscussionKindProps<D>;

export type CommonDiscussionDto = {
  address: AddressDto;
  businessName: BusinessName;
  conventionId?: ConventionId;
  createdAt: DateString;
  updatedAt: DateString;
  id: DiscussionId;
  siret: SiretDto;
  locationId?: LocationId;
} & WithDiscussionStatus &
  WithBannedEstablishmentInformations;

export type ExtraDiscussionDtoProperties = WithAcquisition & {
  appellationCode: AppellationCode;
  exchanges: Exchange[];
};

type SpecificDiscussionDto<D extends DiscussionKind> = {
  contactMode: ContactMode;
  kind: D;
  potentialBeneficiary: DiscussionPotentialBeneficiary<D>;
};

type GenericDiscussionDto<D extends DiscussionKind> = CommonDiscussionDto &
  ExtraDiscussionDtoProperties &
  SpecificDiscussionDto<D>;

export type DiscussionStatus = DiscussionDto["status"];
export type RejectionKind = WithDiscussionStatusRejected["rejectionKind"];

export type WithDiscussionStatus =
  | WithDiscussionStatusAccepted
  | WithDiscussionStatusRejected
  | WithDiscussionStatusPending;

export type WithDiscussionStatusAccepted = {
  status: "ACCEPTED";
  candidateWarnedMethod: CandidateWarnedMethod | null;
  conventionId?: ConventionId;
};

export type WithDiscussionStatusRejected = {
  status: "REJECTED";
} & WithDiscussionRejection;

export type WithDiscussionStatusPending = {
  status: "PENDING";
};

export const discussionStatuses: DiscussionStatus[] = [
  "ACCEPTED",
  "REJECTED",
  "PENDING",
];

export type WithDiscussionRejection =
  | RejectionWithoutReason
  | RejectionWithReason
  | RejectionCandidateAlreadyWarned;

type RejectionWithoutReason = {
  rejectionKind: "UNABLE_TO_HELP" | "NO_TIME" | "DEPRECATED";
};

type RejectionWithReason = {
  rejectionKind: "OTHER";
  rejectionReason: string;
};

export type RejectionCandidateAlreadyWarned = {
  rejectionKind: "CANDIDATE_ALREADY_WARNED";
  candidateWarnedMethod: CandidateWarnedMethod;
};

export type UpdateDiscussionStatusParams = WithDiscussionId &
  WithDiscussionStatus;

export type WithDiscussionDto = {
  discussion: DiscussionDto;
};

export type DiscussionDto = DiscussionDtoIF | DiscussionDto1Eleve1Stage;

export type DiscussionDtoIF = GenericDiscussionDto<"IF">;
export type DiscussionDto1Eleve1Stage = GenericDiscussionDto<"1_ELEVE_1_STAGE">;

export type GenericDiscussionReadDto<D extends DiscussionKind> =
  CommonDiscussionDto &
    SpecificDiscussionDto<D> & {
      appellation: AppellationAndRomeDto;
      exchanges: ExchangeRead[];
    };

export type DiscussionReadDto =
  | GenericDiscussionReadDto<"IF">
  | GenericDiscussionReadDto<"1_ELEVE_1_STAGE">;

export type Attachment = {
  name: string;
  link: string;
};

export type Message = Flavor<string, "Message">;
export type Subject = Flavor<string, "Subject">;

type CommonExchange = {
  subject: Subject;
  message: Message;
  sentAt: DateString;
  attachments: Attachment[];
};

export type SpecificExchangeSender<S extends ExchangeRole> =
  S extends "establishment"
    ? {
        sender: S;
        firstname: Firstname;
        lastname: Lastname;
        email: Email;
      }
    : {
        sender: S;
      };

export type EstablishmentExchange = CommonExchange &
  SpecificExchangeSender<"establishment">;
export type PotentialBeneficiaryExchange = CommonExchange &
  SpecificExchangeSender<"potentialBeneficiary">;

export type ExchangeSender =
  | SpecificExchangeSender<"establishment">
  | SpecificExchangeSender<"potentialBeneficiary">;

export type Exchange = EstablishmentExchange | PotentialBeneficiaryExchange;

export type ExchangeRead = CommonExchange &
  (
    | SpecificExchangeSender<"potentialBeneficiary">
    | OmitFromExistingKeys<SpecificExchangeSender<"establishment">, "email">
  );

export type ExchangeMessageFromDashboard = Pick<Exchange, "message"> & {
  recipientRole: ExchangeRole;
};

export type ExchangeFromDashboard = ExchangeMessageFromDashboard &
  WithDiscussionId;

export type DiscussionDisplayStatus =
  | "accepted"
  | "rejected"
  | "pending"
  | "new";

export type DiscussionDisplayStatusByRole = {
  [R in ExchangeRole]: DiscussionDisplayStatus;
};

export type DiscussionFollowUp = "needs-answer" | "to-remind";

export type DiscussionFollowUpByRole = {
  [R in ExchangeRole]: R extends "establishment"
    ? Exclude<DiscussionFollowUp, "to-remind">
    : DiscussionFollowUp;
};

export type DiscussionInList = Pick<
  DiscussionReadDto,
  | "id"
  | "appellation"
  | "businessName"
  | "createdAt"
  | "siret"
  | "kind"
  | "status"
  | "contactMode"
  | "updatedAt"
  | "isEstablishmentBanned"
> & {
  potentialBeneficiary: {
    firstName: Firstname;
    lastName: Lastname;
    phone: string | null;
  };
  immersionObjective: ImmersionObjective | null;
  city: string;
  exchangesData: {
    count: number;
    lastExchange: Pick<ExchangeRead, "sender" | "sentAt"> | null;
    hasEstablishmentAnswered: boolean;
  };
} & WithPhoneContactAdditionalCondition;

export type DiscussionOrderKey = ExtractFromExisting<
  keyof DiscussionInList,
  "createdAt"
>;

export type DiscussionOrderDirection = "asc" | "desc";

export type FlatGetPaginatedDiscussionsParams = {
  // pagination
  page?: number;
  perPage?: number;

  // sort
  orderBy?: DiscussionOrderKey;
  orderDirection?: DiscussionOrderDirection;

  // filters
  statuses?: DiscussionStatus | DiscussionStatus[];
  search?: SearchTextAlphaNumeric;
  userRole: ExchangeRole;
};

export const isDiscussionInList = (
  discussion: DiscussionReadDto | DiscussionInList,
): discussion is DiscussionInList => {
  return "exchangesData" in discussion;
};

export const discussionToExchangesData = (
  discussion: DiscussionDto | DiscussionReadDto,
): DiscussionInList["exchangesData"] => {
  const lastExchange = discussion.exchanges[discussion.exchanges.length - 1];
  const hasEstablishmentAnswered = discussion.exchanges.some(
    (exchange) => exchange.sender === "establishment",
  );
  return {
    count: discussion.exchanges.length,
    hasEstablishmentAnswered,
    lastExchange: lastExchange
      ? { sender: lastExchange.sender, sentAt: lastExchange.sentAt }
      : null,
  };
};
