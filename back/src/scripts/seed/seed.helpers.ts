import {
  AgencyDtoBuilder,
  type AgencyId,
  type AgencyKind,
  type AgencyUsersRights,
  type Email,
  SEED_AGENCY_WITH_REFERS_TO_ID,
  SEED_FT_AGENCY_ID,
  type UserId,
} from "shared";
import type { UnitOfWork } from "../../domains/core/unit-of-work/ports/UnitOfWork";
import { UuidV4Generator } from "../../domains/core/uuid-generator/adapters/UuidGeneratorImplementations";
import { toAgencyWithRights } from "../../utils/agency";
import { getRandomAddress, seedAddresses } from "./seedAddresses";

export const getRandomAgencyId = ({
  kind,
  agencyIds,
}: {
  kind: AgencyKind;
  agencyIds: Record<AgencyKind, AgencyId[]>;
}) => {
  const ids = agencyIds[kind];
  return ids[Math.floor(Math.random() * ids.length)];
};

export const insertAgencySeed = async ({
  uow,
  kind,
  userId,
  agencyContactEmail,
}: {
  uow: UnitOfWork;
  kind: AgencyKind;
  userId: UserId;
  agencyContactEmail: Email;
}): Promise<AgencyId> => {
  const address = getRandomAddress();
  const agencyName = `Agence ${kind} ${address.city}`;
  const agencyId = new UuidV4Generator().new();
  const agency = new AgencyDtoBuilder()
    .withId(agencyId)
    .withName(agencyName)
    .withSignature(`${agencyName} signature`)
    .withKind(kind)
    .withStatus("active")
    .withAddress(address)
    .withAgencyContactEmail(agencyContactEmail)
    .build();

  const connectedValidator: AgencyUsersRights = {
    [userId]: {
      isNotifiedByEmail: true,
      roles: ["validator"],
    },
  };

  await uow.agencyRepository.insert(
    toAgencyWithRights(agency, connectedValidator),
  );

  return agencyId;
};

export const insertSpecificAgenciesWithUserRight = async ({
  uow,
  userId,
  agencyIds,
}: {
  uow: UnitOfWork;
  userId: UserId;
  agencyIds: Record<AgencyKind, AgencyId[]>;
}): Promise<Record<AgencyKind, AgencyId[]>> => {
  const ftAgency = new AgencyDtoBuilder()
    .withId(SEED_FT_AGENCY_ID)
    .withName("Agence France Travail Paris")
    .withSignature("PE agency signature")
    .withKind("france-travail")
    .withStatus("active")
    .withAddress(seedAddresses[0])
    .build();

  const capEmploiAgency = new AgencyDtoBuilder()
    .withId("40400c99-9c0b-bbbb-bb6d-6bb9bd300606")
    .withName("Cap emploi Paris")
    .withSignature("mission locale agency signature")
    .withKind("cap-emploi")
    .withStatus("active")
    .withAddress(seedAddresses[1])
    .build();

  const cciAgency = new AgencyDtoBuilder()
    .withId("40400c99-9c0b-bbbb-bb6d-6bb9bd300707")
    .withName("CCI Paris")
    .withSignature("mission locale agency signature")
    .withKind("cci")
    .withStatus("active")
    .withAddress(seedAddresses[2])
    .build();

  const missionLocaleAgency = new AgencyDtoBuilder()
    .withId("40400c99-9c0b-bbbb-bb6d-6bb9bd300505")
    .withName("Mission Locale")
    .withSignature("mission locale agency signature")
    .withKind("mission-locale")
    .withStatus("active")
    .withAddress(seedAddresses[3])
    .build();

  const agencyWithRefersTo = new AgencyDtoBuilder()
    .withId(SEED_AGENCY_WITH_REFERS_TO_ID)
    .withName("Agence manage tests Playwright (double validation)")
    .withSignature("Agence manage double validation signature")
    .withKind("autre")
    .withStatus("active")
    .withAddress(seedAddresses[1])
    .withRefersToAgencyInfo({
      refersToAgencyId: SEED_FT_AGENCY_ID,
      refersToAgencyName: "Agence France Travail Paris",
      refersToAgencyContactEmail: "osef",
    })
    .build();

  const connectedValidator: AgencyUsersRights = {
    [userId]: {
      isNotifiedByEmail: true,
      roles: ["validator"],
    },
  };

  const connectedCounsellor: AgencyUsersRights = {
    [userId]: {
      isNotifiedByEmail: true,
      roles: ["counsellor"],
    },
  };

  await uow.agencyRepository.insert(
    toAgencyWithRights(ftAgency, connectedValidator),
  );
  await uow.agencyRepository.insert(
    toAgencyWithRights(cciAgency, connectedValidator),
  );
  await uow.agencyRepository.insert(
    toAgencyWithRights(capEmploiAgency, connectedValidator),
  );
  await uow.agencyRepository.insert(
    toAgencyWithRights(missionLocaleAgency, connectedValidator),
  );
  await uow.agencyRepository.insert(
    toAgencyWithRights(agencyWithRefersTo, connectedCounsellor),
  );

  return {
    ...agencyIds,
    "france-travail": [...agencyIds["france-travail"], ftAgency.id],
    "mission-locale": [...agencyIds["mission-locale"], missionLocaleAgency.id],
  };
};
