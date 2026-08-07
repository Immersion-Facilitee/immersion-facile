import { values } from "ramda";
import {
  type AddressDto,
  type AgencyDto,
  type AgencyId,
  type AgencyKind,
  type AgencyPositionFilter,
  type AgencyRight,
  type AgencyStatus,
  type AgencyWithUsersRights,
  closedOrRejectedAgencyStatuses,
  type DataWithPagination,
  type DateString,
  type DepartmentCode,
  errors,
  type OmitFromExistingKeys,
  type PaginationQueryParams,
  type SiretDto,
  type UserId,
  type WithUserFilters,
} from "shared";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";

export type GetAgenciesFilters = {
  nameIncludes?: string;
  position?: AgencyPositionFilter;
  departmentCode?: DepartmentCode;
  kinds?: AgencyKind[];
  status?: AgencyStatus[];
  sirets?: SiretDto[];
  doesNotReferToOtherAgency?: true;
  createdAtBefore?: Date;
  userIds?: UserId[];
  delegationConventionEndDate?: DateString;
};

export type GetAgencyIdsFilters = {
  kinds?: AgencyKind[];
  status?: AgencyStatus[];
};

export type AgencyWithoutRights = Omit<
  AgencyDto,
  "counsellorEmails" | "validatorEmails"
>;

export type PartialAgencyWithUsersRights = Partial<AgencyWithUsersRights> & {
  id: AgencyId;
  status: AgencyStatus;
};
export type AgencyRightOfUser = OmitFromExistingKeys<AgencyRight, "agency"> & {
  agencyId: AgencyId;
};

export type AgencyWithNumberOfUsersToReview = {
  agency: AgencyWithUsersRights;
  numberOfUsersToReview: number;
};

export const throwIfAgencyHasNoUsersWhileNotClosedOrRejected = ({
  id,
  status,
  usersRights,
}: Pick<AgencyWithUsersRights, "id" | "status" | "usersRights">): void => {
  if (
    !values(usersRights).length &&
    !closedOrRejectedAgencyStatuses.includes(status)
  )
    throw errors.agency.noUsers(id);
};

export interface AgencyRepository {
  insert(agency: AgencyWithUsersRights, updatedAt?: DateString): Promise<void>;
  update(partialAgency: PartialAgencyWithUsersRights): Promise<void>;

  getById(id: AgencyId): Promise<AgencyWithUsersRights | undefined>;
  getBySafirAndActiveStatus(
    safirCode: string,
  ): Promise<AgencyWithUsersRights[]>;
  getByIds(ids: AgencyId[]): Promise<AgencyWithUsersRights[]>;
  getAgencies(props: {
    filters?: GetAgenciesFilters;
    pagination?: PaginationQueryParams;
  }): Promise<DataWithPagination<AgencyWithUsersRights>>;
  getAgencyIdsByFilters(filters: GetAgencyIdsFilters): Promise<AgencyId[]>;

  getAgenciesRelatedToAgency(id: AgencyId): Promise<AgencyWithUsersRights[]>;
  getAllAgenciesWithUsersToReview(): Promise<AgencyWithNumberOfUsersToReview[]>;
  getImmersionFacileAgencyId(): Promise<AgencyId | undefined>;
  getUserIdWithAgencyRightsByFilters(
    filters: WithUserFilters,
  ): Promise<UserId[]>;
  getAgenciesRightsByUserId(id: UserId): Promise<AgencyRightOfUser[]>;
  alreadyHasActiveAgencyWithSameAddressAndKind(params: {
    address: AddressDto;
    kind: AgencyKind;
    idToIgnore: AgencyId;
  }): Promise<boolean>;
  getExistingActiveSirets(sirets: SiretDto[]): Promise<SiretDto[]>;
  deleteOldClosedAgenciesWithoutConventions(params: {
    updatedBefore: Date;
  }): Promise<AgencyId[]>;
}

export const updateAgencyRightsForUser = async (
  uow: UnitOfWork,
  userId: UserId,
  { agencyId, isNotifiedByEmail, roles }: AgencyRightOfUser,
): Promise<void> => {
  const agencyWithRights = await uow.agencyRepository.getById(agencyId);
  if (!agencyWithRights) throw errors.agency.notFound({ agencyId });
  return uow.agencyRepository.update({
    id: agencyId,
    status: agencyWithRights.status,
    usersRights: {
      ...agencyWithRights.usersRights,
      [userId]: { isNotifiedByEmail, roles },
    },
  });
};

export const removeAgencyRightsForUser = async (
  uow: UnitOfWork,
  userId: UserId,
  { agencyId }: AgencyRightOfUser,
): Promise<void> => {
  const agencyWithRights = await uow.agencyRepository.getById(agencyId);
  if (!agencyWithRights) throw errors.agency.notFound({ agencyId });
  const { [userId]: _, ...rightsToKeep } = agencyWithRights.usersRights;
  return uow.agencyRepository.update({
    id: agencyId,
    status: agencyWithRights.status,
    usersRights: rightsToKeep,
  });
};
