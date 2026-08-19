import type { AgencyId, AgencyKind } from "shared";
import type { UnitOfWork } from "../../domains/core/unit-of-work/ports/UnitOfWork";
import {
  insertAgencySeed,
  insertSpecificAgenciesWithUserRight,
} from "./seed.helpers";
import { seedUsers } from "./userSeed";

export const agencySeed = async (
  uow: UnitOfWork,
): Promise<Record<AgencyKind, AgencyId[]>> => {
  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("agencySeed start ...");

  const agenciesCountByKind = 10;

  const randomAgencies: Record<AgencyKind, AgencyId[]> = {
    "france-travail": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "france-travail",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    "mission-locale": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "mission-locale",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    "cap-emploi": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "cap-emploi",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    "conseil-departemental": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "conseil-departemental",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    "prepa-apprentissage": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "prepa-apprentissage",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    "structure-IAE": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "structure-IAE",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    "fonction-publique": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "fonction-publique",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    cci: await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "cci",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    cma: await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "cma",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    "chambre-agriculture": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "chambre-agriculture",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    autre: await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "autre",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    "immersion-facile": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "immersion-facile",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
    "operateur-cep": await Promise.all(
      [...Array(agenciesCountByKind).keys()].map(() =>
        insertAgencySeed({
          uow,
          kind: "operateur-cep",
          userId: seedUsers.adminUser.id,
          agencyContactEmail: seedUsers.adminUser.email,
        }),
      ),
    ),
  };

  const randomAndSpecificAgencyIds = insertSpecificAgenciesWithUserRight({
    uow,
    userId: seedUsers.adminUser.id,
    agencyIds: randomAgencies,
  });

  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log("agencySeed done");

  return randomAndSpecificAgencyIds;
};
