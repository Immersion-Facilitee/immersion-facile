import { isSameDay, parseISO } from "date-fns";
import { keys, toPairs, uniq, values } from "ramda";
import {
  type AddressDto,
  type AgencyId,
  type AgencyKind,
  type AgencyOption,
  type AgencyPositionFilter,
  type AgencyStatus,
  type AgencyWithUsersRights,
  activeAgencyStatuses,
  calculateLimitAndOffsetFromPagination,
  calculatePaginationResult,
  type DataWithPagination,
  type DateString,
  type DepartmentCode,
  errors,
  type GeoPositionDto,
  isTruthy,
  isWithAgencyRole,
  type PaginationQueryParams,
  type SiretDto,
  type UserId,
  type WithGeoPosition,
  type WithUserFilters,
} from "shared";
import { z } from "zod";
import { distanceBetweenCoordinatesInMeters } from "../../../utils/distanceBetweenCoordinatesInMeters";
import { normalize } from "../../../utils/textSearch";
import {
  type AgencyRepository,
  type AgencyRightOfUser,
  type AgencyWithNumberOfUsersToReview,
  type GetAgenciesFilters,
  type GetAgencyIdsFilters,
  type PartialAgencyWithUsersRights,
  throwIfAgencyHasNoUsersWhileNotClosedOrRejected,
} from "../ports/AgencyRepository";

type AgencyById = Partial<Record<AgencyId, AgencyWithUsersRights>>;

// PostgreSQL uuid accepts GUID-shaped values without RFC version/variant bits,
// so use z.guid() here instead of stricter z.uuid().
const guidSchema = z.guid();

const isUuid = (value: string) => guidSchema.safeParse(value.trim()).success;

export class InMemoryAgencyRepository implements AgencyRepository {
  constructor(agencyList: AgencyWithUsersRights[] = testAgencies) {
    agencyList.forEach((agency) => {
      this.#agencies[agency.id] = agency;
    });
  }

  #agencies: AgencyById = {};

  // test purpose only
  public get agencies(): AgencyWithUsersRights[] {
    return values(this.#agencies).filter(isTruthy);
  }

  public set agencies(agencies: AgencyWithUsersRights[]) {
    this.#agencies = agencies.reduce(
      (acc, agency) => ({
        ...acc,
        [agency.id]: agency,
      }),
      {},
    );
  }

  public async insert(
    agency: AgencyWithUsersRights,
    _updatedAt?: DateString,
  ): Promise<void> {
    if (this.#agencies[agency.id]) throw errors.agency.alreadyExist(agency.id);
    throwIfAgencyHasNoUsersWhileNotClosedOrRejected(agency);
    this.#agencies[agency.id] = agency;
  }

  public async update(agency: PartialAgencyWithUsersRights) {
    const agencyToUdpate = this.#agencies[agency.id];
    if (!agencyToUdpate) {
      throw errors.agency.notFound({ agencyId: agency.id });
    }

    const updatedAgency = { ...agencyToUdpate, ...agency };
    if (agency.usersRights !== undefined)
      throwIfAgencyHasNoUsersWhileNotClosedOrRejected(updatedAgency);
    this.#agencies[agency.id] = updatedAgency;
  }

  public async getById(
    id: AgencyId,
  ): Promise<AgencyWithUsersRights | undefined> {
    return this.#agencies[id];
  }

  public async getBySafirAndActiveStatus(
    safirCode: string,
  ): Promise<AgencyWithUsersRights[]> {
    return values(this.#agencies)
      .filter(isTruthy)
      .filter(
        (agency) =>
          agency.codeSafir === safirCode &&
          activeAgencyStatuses.includes(agency.status),
      );
  }

  public async getByIds(ids: AgencyId[]): Promise<AgencyWithUsersRights[]> {
    const result = ids.reduce<{
      agencies: AgencyWithUsersRights[];
      missingIds: AgencyId[];
    }>(
      (prev, id) => {
        const agency = this.#agencies[id];
        return {
          agencies: agency ? [...prev.agencies, agency] : prev.agencies,
          missingIds: !agency ? [...prev.missingIds, id] : prev.missingIds,
        };
      },
      {
        agencies: [],
        missingIds: [],
      },
    );
    if (result.missingIds.length)
      throw errors.agencies.notFound({
        missingAgencyIds: result.missingIds,
        presentAgencyIds: result.agencies.map((agency) => agency.id),
      });
    return result.agencies;
  }

  public async getAgencies({
    filters = {},
    pagination,
  }: {
    filters?: GetAgenciesFilters;
    pagination?: PaginationQueryParams;
  }): Promise<DataWithPagination<AgencyWithUsersRights>> {
    const allFiltered = Object.values(this.#agencies)
      .filter(isTruthy)
      .filter(
        (agency) =>
          ![
            agencyHasCoveredDepartmentCode(agency, filters?.departmentCode),
            agencyHasName(agency, filters?.nameIncludes),
            agencyIsOfKind(agency, filters?.kinds),
            agencyIsOfPosition(agency, filters?.position),
            agencyIsOfStatus(agency, filters?.status),
            agencyHasSirets(agency, filters?.sirets),
            agencyDoesNotReferToOtherAgency(
              agency,
              filters?.doesNotReferToOtherAgency,
            ),
            agencyCreatedAtBefore(agency, filters?.createdAtBefore),
            agencyHasUserIds(agency, filters?.userIds),
            agencyDelegationConventionEndsOnDate(
              agency,
              filters?.delegationConventionEndDate,
            ),
          ].includes(false),
      );

    const sorted = filters?.position
      ? allFiltered.sort(sortByNearestFrom(filters.position.position))
      : allFiltered.sort((a, b) => a.id.localeCompare(b.id));

    const totalRecords = sorted.length;
    const resolvedPagination = {
      page: pagination?.page ?? 1,
      perPage: pagination?.perPage ?? (totalRecords || 1),
    };
    const { limit, offset } =
      calculateLimitAndOffsetFromPagination(resolvedPagination);

    return {
      data: sorted.slice(offset, offset + limit),
      pagination: calculatePaginationResult({
        ...resolvedPagination,
        totalRecords,
      }),
    };
  }

  public async getAgencyIdsByFilters(
    filters: GetAgencyIdsFilters,
  ): Promise<AgencyId[]> {
    return Object.values(this.#agencies)
      .filter(isTruthy)
      .filter(
        (agency) =>
          agencyIsOfKind(agency, filters.kinds) &&
          agencyIsOfStatus(agency, filters.statuses),
      )
      .map(({ id }) => id)
      .sort((a, b) => a.localeCompare(b));
  }

  public async getAgenciesRelatedToAgency(
    id: AgencyId,
  ): Promise<AgencyWithUsersRights[]> {
    return values(this.#agencies)
      .filter(isTruthy)
      .filter((agency) => agency.refersToAgencyId === id);
  }

  public async getAllAgenciesWithUsersToReview(): Promise<
    AgencyWithNumberOfUsersToReview[]
  > {
    return values(this.#agencies)
      .filter(isTruthy)
      .map((agency) => {
        const numberOfUsersToReview = toPairs(agency.usersRights).filter(
          ([_, right]) => right?.roles.includes("to-review"),
        ).length;

        return {
          agency,
          numberOfUsersToReview,
        };
      })
      .filter((result) => result.numberOfUsersToReview > 0);
  }

  public async getImmersionFacileAgencyId(): Promise<AgencyId | undefined> {
    return values(this.#agencies)
      .filter(isTruthy)
      .find((agency) => agency.kind === "immersion-facile")?.id;
  }

  public async getUserIdWithAgencyRightsByFilters(
    filters: WithUserFilters,
  ): Promise<UserId[]> {
    if (!isWithAgencyRole(filters)) {
      const agency = this.#agencies[filters.agencyId];
      if (!agency) throw errors.agency.notFound(filters);
      return keys(agency.usersRights).sort();
    }

    return uniq(
      values(this.#agencies)
        .filter(isTruthy)
        .reduce<UserId[]>((acc, agency) => {
          const userIds = toPairs(agency.usersRights)
            .filter(([_, right]) => right?.roles.includes(filters.agencyRole))
            .map(([userId]) => userId);
          return [...acc, ...userIds].sort();
        }, []),
    );
  }

  public async getAgenciesRightsByUserId(
    id: UserId,
  ): Promise<AgencyRightOfUser[]> {
    return values(this.#agencies).reduce<AgencyRightOfUser[]>((acc, agency) => {
      const userRights = agency?.usersRights[id];
      return [
        ...acc,
        ...(userRights
          ? [
              {
                agencyId: agency.id,
                ...userRights,
              } satisfies AgencyRightOfUser,
            ]
          : []),
      ];
    }, []);
  }

  public async alreadyHasActiveAgencyWithSameAddressAndKind({
    address,
    kind,
    idToIgnore,
  }: {
    address: AddressDto;
    kind: AgencyKind;
    idToIgnore: AgencyId;
  }): Promise<boolean> {
    return this.agencies.some(
      (agency) =>
        agency.kind === kind &&
        agency.address.streetNumberAndAddress ===
          address.streetNumberAndAddress &&
        agency.address.city === address.city &&
        [...activeAgencyStatuses, "needsReview"].includes(agency.status) &&
        agency.id !== idToIgnore,
    );
  }

  public async getExistingActiveSirets(
    sirets: SiretDto[],
  ): Promise<SiretDto[]> {
    return this.agencies
      .filter(
        (agency) =>
          activeAgencyStatuses.includes(agency.status) &&
          sirets.includes(agency.agencySiret),
      )
      .map((agency) => agency.agencySiret);
  }

  public async deleteOldClosedAgenciesWithoutConventions(_params: {
    updatedBefore: Date;
  }): Promise<AgencyId[]> {
    throw errors.generic.fakeError("Not implemented");
  }
}

const sortByNearestFrom =
  (position: GeoPositionDto) =>
  (a: AgencyOption & WithGeoPosition, b: AgencyOption & WithGeoPosition) =>
    distanceBetweenCoordinatesInMeters(a.position, position) -
    distanceBetweenCoordinatesInMeters(b.position, position);

const agencyIsOfKind = (
  agency: AgencyWithUsersRights,
  agencyKinds?: AgencyKind[],
): boolean => {
  if (!agencyKinds) return true;
  return agencyKinds.includes(agency.kind);
};

const agencyIsOfStatus = (
  agency: AgencyWithUsersRights,
  statuses?: AgencyStatus[],
): boolean => {
  if (!statuses) return true;
  return statuses.includes(agency.status);
};

const agencyHasCoveredDepartmentCode = (
  agency: AgencyWithUsersRights,
  departmentCode?: DepartmentCode,
): boolean =>
  departmentCode ? agency.coveredDepartments.includes(departmentCode) : true;

const agencyHasName = (
  agency: AgencyWithUsersRights,
  nameIncludes?: string,
): boolean => {
  if (!nameIncludes) return true;

  const trimmedName = nameIncludes.trim();
  if (isUuid(trimmedName))
    return agency.id.toLowerCase() === trimmedName.toLowerCase();

  const nameIncludesWords = nameIncludes
    .split(/[^\p{L}\p{N}]+/u)
    .filter(isTruthy);
  const normalizedAgencyName = normalize(agency.name);

  return nameIncludesWords.every((nameIncludesWord) =>
    normalizedAgencyName.includes(normalize(nameIncludesWord)),
  );
};

const agencyHasUserIds = (
  agency: AgencyWithUsersRights,
  userIds?: UserId[],
) => {
  if (userIds?.length === 0) return false;
  return userIds
    ? keys(agency.usersRights).some((userId) => userIds.includes(userId))
    : true;
};

const agencyHasSirets = (
  agency: AgencyWithUsersRights,
  sirets?: SiretDto[],
): boolean => {
  if (!sirets || sirets.length === 0) return true;
  return sirets.includes(agency.agencySiret);
};

const agencyDoesNotReferToOtherAgency = (
  agency: AgencyWithUsersRights,
  shouldNotReferToOtherAgency?: true,
): boolean => {
  if (shouldNotReferToOtherAgency === undefined) return true;
  return agency.refersToAgencyId === null;
};

const agencyIsOfPosition = (
  agency: AgencyWithUsersRights,
  positionFilter?: AgencyPositionFilter,
): boolean => {
  if (!positionFilter) return true;
  return (
    distanceBetweenCoordinatesInMeters(
      agency.position,
      positionFilter.position,
    ) <
    positionFilter.distance_km * 1000
  );
};

const agencyCreatedAtBefore = (
  agency: AgencyWithUsersRights,
  createdAtBefore: Date | undefined,
): boolean => {
  if (createdAtBefore === undefined) return true;
  return new Date(agency.createdAt) <= createdAtBefore;
};

const agencyDelegationConventionEndsOnDate = (
  agency: AgencyWithUsersRights,
  delegationConventionEndDate: DateString | undefined,
): boolean => {
  if (delegationConventionEndDate === undefined) return true;

  const agencyDelegationEndDate =
    agency.delegationAgencyInfo?.delegationEndDate;
  if (!agencyDelegationEndDate) return false;

  return isSameDay(
    parseISO(agencyDelegationEndDate),
    parseISO(delegationConventionEndDate),
  );
};

const defaultCreatedAt = new Date("2025-02-02").toISOString();

const agency3: AgencyWithUsersRights = {
  id: "test-agency-3-back",
  name: "Test Agency 3 (back)",
  status: "active",
  agencySiret: "00000000000000",
  kind: "pole-emploi",
  usersRights: {
    validatorUserA3: { isNotifiedByEmail: true, roles: ["validator"] },
  },
  signature: "Signature of Test Agency 3",
  coveredDepartments: ["64"],
  address: {
    streetNumberAndAddress: "3 Agency street",
    departmentCode: "64",
    city: "Bayonne",
    postcode: "64100",
  },
  position: {
    lat: 88,
    lon: 89.9999,
  },
  logoUrl: "http://LOGO AGENCY 3 URL",
  refersToAgencyId: null,
  refersToAgencyName: null,
  refersToAgencyContactEmail: null,
  contactEmail: "agency-contact@mail.com",
  codeSafir: null,
  statusJustification: null,
  phoneNumber: "+33600000003",
  createdAt: defaultCreatedAt,
  delegationAgencyInfo: null,
};

const agency1: AgencyWithUsersRights = {
  id: "test-agency-1-back",
  name: "Test Agency 1 (back)",
  status: "active",
  kind: "pole-emploi",
  usersRights: {
    counsellorUserA1: { isNotifiedByEmail: true, roles: ["counsellor"] },
    validatorUserA1: { isNotifiedByEmail: true, roles: ["validator"] },
  },
  signature: "Signature of Test Agency 1",
  agencySiret: "00000000000000",
  coveredDepartments: ["75"],
  address: {
    streetNumberAndAddress: "Agency 1 address",
    departmentCode: "75",
    city: "AgencyCity",
    postcode: "75001",
  },
  position: {
    lat: 1,
    lon: 2,
  },
  logoUrl: "http://LOGO AGENCY 1 URL",
  refersToAgencyId: null,
  refersToAgencyName: null,
  refersToAgencyContactEmail: null,
  contactEmail: "agency-contact@mail.com",
  codeSafir: null,
  statusJustification: null,
  phoneNumber: "+33600000001",
  createdAt: defaultCreatedAt,
  delegationAgencyInfo: null,
};

const testAgencies: AgencyWithUsersRights[] = [
  {
    id: "immersion-facile-agency",
    name: "Immersion Facile Agency (back)",
    status: "active",
    kind: "immersion-facile",
    usersRights: {
      counsellorUser: { isNotifiedByEmail: true, roles: ["counsellor"] },
      validatorUser: { isNotifiedByEmail: true, roles: ["validator"] },
    },
    signature: "Signature of Immersion Facile",
    agencySiret: "00000000000000",
    coveredDepartments: ["75"],
    address: {
      streetNumberAndAddress: "No address",
      departmentCode: "75",
      city: "NoWhere",
      postcode: "75001",
    },
    position: {
      lat: 22.319469,
      lon: 114.189505,
    },
    logoUrl: "http://LOGO AGENCY IF URL",
    refersToAgencyId: null,
    refersToAgencyName: null,
    refersToAgencyContactEmail: null,
    contactEmail: "agency-contact@mail.com",
    codeSafir: null,
    statusJustification: null,
    phoneNumber: "+33600000000",
    createdAt: defaultCreatedAt,
    delegationAgencyInfo: null,
  },
  agency1,
  {
    id: "test-agency-2-back",
    name: "Test Agency 2 (back)",
    status: "active",
    kind: "mission-locale",
    agencySiret: "00000000000000",
    usersRights: {
      counsellorUser1A2: { isNotifiedByEmail: true, roles: ["counsellor"] },
      counsellorUser2A2: { isNotifiedByEmail: true, roles: ["counsellor"] },
      validatorUser1A2: { isNotifiedByEmail: true, roles: ["validator"] },
      validatorUser2A2: { isNotifiedByEmail: true, roles: ["validator"] },
    },
    signature: "Signature of Test Agency 2",
    coveredDepartments: ["68"],
    address: {
      city: "Mulhouse",
      departmentCode: "68",
      postcode: "68100",
      streetNumberAndAddress: "48 Rue Franklin",
    },
    position: {
      lat: 40,
      lon: 50,
    },
    logoUrl: "http://LOGO AGENCY 2 URL",
    refersToAgencyId: null,
    refersToAgencyName: null,
    refersToAgencyContactEmail: null,
    contactEmail: "agency-contact@mail.com",
    statusJustification: null,
    codeSafir: null,
    phoneNumber: "+33600000002",
    createdAt: defaultCreatedAt,
    delegationAgencyInfo: null,
  },
  agency3,
  {
    id: "test-agency-4-back-with-refers-to",
    name: "Test Agency 4 (back) - refers to Test Agency 3",
    status: "active",
    agencySiret: "00000000000000",
    kind: "autre",
    usersRights: {
      counsellorUserA4: { isNotifiedByEmail: true, roles: ["counsellor"] },
      validatorUserA4: { isNotifiedByEmail: true, roles: ["validator"] },
    },
    signature: "Signature of Test Agency 4 accompagnante",
    coveredDepartments: ["64"],
    address: {
      streetNumberAndAddress: "4 Agency street",
      departmentCode: "64",
      city: "Bayonne",
      postcode: "64100",
    },
    position: {
      lat: 88,
      lon: 89.9999,
    },
    logoUrl: "http://LOGO AGENCY 4 URL",
    refersToAgencyId: agency3.id,
    refersToAgencyName: agency3.name,
    refersToAgencyContactEmail: agency3.contactEmail,
    contactEmail: "agency-contact@mail.com",
    statusJustification: null,
    codeSafir: null,
    phoneNumber: "+33600000004",
    createdAt: defaultCreatedAt,
    delegationAgencyInfo: {
      delegationEndDate: new Date("2029-01-01").toISOString(),
      delegationAgencyName: "Delegation Agency 1",
      delegationAgencyKind: "pole-emploi",
    },
  },
  {
    id: "test-agency-5-back-with-refers-to",
    name: "Test Agency 5 (back) - refers to Test Agency 1",
    status: "active",
    agencySiret: "00000000000000",
    kind: "autre",
    usersRights: {
      counsellorUserA5: { isNotifiedByEmail: true, roles: ["counsellor"] },
      validatorUserA1: { isNotifiedByEmail: true, roles: ["validator"] },
    },
    signature: "Signature of Test Agency 5 accompagnante",
    coveredDepartments: ["64"],
    address: {
      streetNumberAndAddress: "5 Agency street",
      departmentCode: "64",
      city: "Bayonne",
      postcode: "64100",
    },
    position: {
      lat: 88,
      lon: 89.9999,
    },
    logoUrl: "http://LOGO AGENCY 5 URL",
    refersToAgencyId: agency1.id,
    refersToAgencyName: agency1.name,
    refersToAgencyContactEmail: agency1.contactEmail,
    contactEmail: "agency-contact@mail.com",
    statusJustification: null,
    codeSafir: null,
    phoneNumber: "+33600000005",
    createdAt: defaultCreatedAt,
    delegationAgencyInfo: {
      delegationEndDate: new Date("2028-01-01").toISOString(),
      delegationAgencyName: "Delegation Agency 2",
      delegationAgencyKind: "pole-emploi",
    },
  },
];
