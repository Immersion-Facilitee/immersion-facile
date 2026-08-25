import { keys, omit } from "ramda";
import type { AbsoluteUrl } from "../AbsoluteUrl";
import type { WithAcquisition } from "../acquisition.dto";
import type { AddressDto, DepartmentCode } from "../address/address.dto";
import type { ConventionFormInitialValues } from "../convention/conventionPresentation.dto";
import type { Email } from "../email/email.dto";
import type { GeoPositionDto } from "../geoPosition/geoPosition.dto";
import type { AgencyRole } from "../role/role.dto";
import type { SearchTextAlphaNumeric } from "../search/searchText.schema";
import type { SiretDto } from "../siret/siret";
import type { Flavor } from "../typeFlavors";
import type { UserId } from "../user/user.dto";
import type { ExtractFromExisting, OmitFromExistingKeys } from "../utils";
import type { DateString, DateTimeIsoString } from "../utils/date";

export type CodeSafir = Flavor<string, "CodeSafir">;
export type AgencyStatus = (typeof allAgencyStatuses)[number];
export const allAgencyStatuses = [
  "active",
  "closed",
  "rejected",
  "needsReview",
  "from-api-PE",
] as const;
export const activeAgencyStatuses: AgencyStatus[] = ["active", "from-api-PE"];
export const closedOrRejectedAgencyStatuses: AgencyStatus[] = [
  "closed",
  "rejected",
];
export const settableAgencyStatusesThroughUpdate: AgencyStatus[] = [
  "active",
  "from-api-PE",
  "rejected",
  "closed",
];

export type CreateAgencyDto = {
  id: AgencyId;
  kind: AgencyKind;
  name: string;
  createdAt: DateString;
  coveredDepartments: DepartmentCode[];
  address: AddressDto;
  position: GeoPositionDto;
  counsellorEmails: Email[];
  validatorEmails: Email[];
  contactEmail: Email;
  agencySiret: SiretDto;
  logoUrl: AbsoluteUrl | null;
  signature: string;
  refersToAgencyId: AgencyId | null;
  refersToAgencyName: string | null;
  refersToAgencyContactEmail: Email | null;
  phoneNumber: string;
  delegationAgencyInfo: DelegationAgencyInfo | null;
} & WithAcquisition;

export type CreateAgencyInitialValues = Omit<CreateAgencyDto, "kind"> & {
  kind: AgencyKind | "";
};

export type AgencyDtoSensitiveFields = {
  status: AgencyStatus;
  statusJustification: string | null;
  codeSafir: CodeSafir | null;
};

export type WithAgencyDto = {
  agency: AgencyDto;
};
export type AgencyDto = CreateAgencyDto &
  AgencyDtoSensitiveFields & { updatedAt: DateTimeIsoString };

export type AgencyUserRight = {
  roles: AgencyRole[];
  isNotifiedByEmail: boolean;
};
export type AgencyUsersRights = Partial<Record<UserId, AgencyUserRight>>;
export type WithAgencyUserRights = {
  usersRights: AgencyUsersRights;
};
export type AgencyWithUsersRights = OmitFromExistingKeys<
  AgencyDto,
  "counsellorEmails" | "validatorEmails"
> &
  WithAgencyUserRights;

export type PartialAgencyDto = Partial<AgencyDto> & { id: AgencyId };

type WithAdminEmails = {
  admins: Email[];
};

export type AgencyDtoForAgencyUsersAndAdmins = OmitFromExistingKeys<
  AgencyDto,
  "counsellorEmails" | "validatorEmails"
> &
  WithAdminEmails;

export type AgencyId = Flavor<string, "AgencyId">;
export type AgencyIdResponse = AgencyId | undefined;
export type WithAgencyId = {
  agencyId: AgencyId;
};

export type CloseAgencyAndTransferConventionsRequestDto = {
  agencyToCloseId: AgencyId;
  agencyToTransferConventionsToId: AgencyId;
};

export const miniStageAgencyKinds: AgencyKind[] = [
  "cci",
  "cma",
  "chambre-agriculture",
];

export type AgencyKind = (typeof orderedAgencyKindList)[number];

export const orderedAgencyKindList = [
  // ⚠️DO NOT EDIT ORDER ⚠️
  // This is the preferred order for displaying the kinds in a select
  "france-travail",
  "mission-locale",
  "operateur-cep",
  "cap-emploi",
  "conseil-departemental",
  "structure-IAE",
  "fonction-publique",
  "cci",
  "cma",
  "chambre-agriculture",
  "autre",
  "immersion-facile",
  "prepa-apprentissage", // legacy kept only for backward compatibility
] as const;

export type PartnerAgencyKind = (typeof partnerAgencyKindList)[number];

export const partnerAgencyKindList = [
  // ⚠️ DO NOT EDIT ⚠️
  // Used by API v2 and partner broadcasts. Keep "pole-emploi" for backward compatibility.
  "pole-emploi",
  "mission-locale",
  "operateur-cep",
  "cap-emploi",
  "conseil-departemental",
  "structure-IAE",
  "fonction-publique",
  "cci",
  "cma",
  "chambre-agriculture",
  "autre",
  "immersion-facile",
  "prepa-apprentissage",
] as const;

export type AllowedAgencyKindToAdd = Exclude<
  AgencyKind,
  "immersion-facile" | "prepa-apprentissage"
>;

export const agencyKindToLabel: Record<AllowedAgencyKindToAdd, string> = {
  "france-travail": "France Travail (anciennement Pôle emploi)",
  "mission-locale": "Mission Locale",
  "operateur-cep": "Opérateur du CEP",
  "cap-emploi": "Cap Emploi",
  "conseil-departemental": "Conseil Départemental",
  "structure-IAE": "Structure IAE",
  "fonction-publique": "Fonction publique",
  cci: "Chambres de Commerce et d'Industrie",
  cma: "Chambre des métiers de l'Artisanat",
  "chambre-agriculture": "Chambre d'agriculture",
  autre: "Autre",
};

export const agencyKindToLabelIncludingIFAndPrepa: Record<AgencyKind, string> =
  {
    ...agencyKindToLabel,
    "prepa-apprentissage": "Prépa Apprentissage",
    "immersion-facile": "Immersion Facilitée",
  };

export const allAgencyKindsAllowedToAdd = keys(agencyKindToLabel).sort(
  (a, b) =>
    orderedAgencyKindList.findIndex((kind) => kind === a) -
    orderedAgencyKindList.findIndex((kind) => kind === b),
);

export const fitForDelegationAgencyKind = allAgencyKindsAllowedToAdd.filter(
  (kind) => !["autre", "cci", "operateur-cep"].includes(kind),
);

export const delegationAgencyKindList = [
  "france-travail",
  "mission-locale",
  "conseil-departemental",
  "cap-emploi",
] as const;

export type DelegationAgencyKind = (typeof delegationAgencyKindList)[number];

export type DelegationAgencyInfo = {
  delegationEndDate: DateString | null;
  delegationAgencyName: string | null;
  delegationAgencyKind: DelegationAgencyKind | null;
};

export const delegationConventionReminderKinds = [
  "threeMonthsBefore",
  "oneMonthBefore",
  "dayAfterExpiry",
] as const;

export type DelegationConventionReminderKind =
  (typeof delegationConventionReminderKinds)[number];

export type AgencyOption = {
  id: AgencyId;
  name: string;
  kind: AgencyKind;
  status: AgencyStatus;
  address: AddressDto;
  refersToAgencyName: string | null;
};

export const agencyKindFilters = [
  "immersionFtOnly",
  "miniStageOnly",
  "miniStageExcluded",
  "withoutRefersToAgency",
] as const;

export type AgencyKindFilter = (typeof agencyKindFilters)[number];

export type AgencyPositionFilter = {
  position: GeoPositionDto;
  distance_km: number;
};

export type GetAgenciesFilter = {
  nameIncludes?: SearchTextAlphaNumeric;
  position?: AgencyPositionFilter;
  departmentCode?: DepartmentCode;
  filterKind?: AgencyKindFilter;
  status?: AgencyStatus[];
  siret?: SiretDto;
};

export const maxAgencyOptionsPerRequest = 20;

export type ListAgencyOptionsRequestDto = Omit<
  GetAgenciesFilter,
  "position"
> & {
  limit?: number;
};

export type PrivateListAgenciesRequestDto = {
  status?: AgencyStatus;
};

export type ActiveOrRejectedStatus = ExtractFromExisting<
  AgencyStatus,
  "active" | "rejected"
>;

export const agencyStatusToLabel: Record<AgencyStatus, string> = {
  active: "Active",
  closed: "Fermée",
  rejected: "Rejetée",
  needsReview: "En attente d'activation",
  "from-api-PE": "Import Api",
};

export const toAgencyDtoForAgencyUsersAndAdmins = (
  agency: AgencyDto | AgencyWithUsersRights,
  admins: Email[],
): AgencyDtoForAgencyUsersAndAdmins => ({
  ...("usersRights" in agency
    ? omit(["usersRights"], agency)
    : omit(["counsellorEmails", "validatorEmails"], agency)),
  admins,
});

export const makeListAgencyOptionsKindFilter = ({
  shouldListAll,
  convention,
}: {
  shouldListAll: boolean;
  convention: ConventionFormInitialValues;
}): AgencyKindFilter => {
  if (convention.internshipKind === "mini-stage-cci") return "miniStageOnly";
  if (shouldListAll) return "miniStageExcluded";
  return convention.signatories?.beneficiary?.federatedIdentity?.provider ===
    "ftConnect"
    ? "immersionFtOnly"
    : "miniStageExcluded";
};

export type WithAgencyIds = {
  agencies: AgencyId[];
};

export type AgencyRight = {
  agency: AgencyDtoForAgencyUsersAndAdmins;
  roles: AgencyRole[];
  isNotifiedByEmail: boolean;
};

export type WithAgencyRights = {
  agencyRights: AgencyRight[];
};

export type AgencyStatsDashboards = {
  // statistics dashboards :
  statsEstablishmentDetailsUrl: AbsoluteUrl | null;
  agencyManagement: AbsoluteUrl | null;
  establishmentManagement: AbsoluteUrl | null;
};

export type AgencyDashboards = AgencyStatsDashboards & {
  erroredConventionsDashboardUrl: AbsoluteUrl | null;
  // convention dashboard :
  agencyDashboardUrl: AbsoluteUrl | null;
};

export type WithAgencyDashboards = {
  agencies: AgencyDashboards;
};
