import { startOfDay } from "date-fns";
import {
  type AgencyKind,
  type AgencyStatus,
  type AgencyWithUsersRights,
  type ConventionStatus,
  conventionStatuses,
  executeInSequence,
  isTruthy,
  isUnvalidatedConventionStatus,
  type UnvalidatedConventionStatus,
} from "shared";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import type { GetAgenciesFilters } from "../ports/AgencyRepository";

const agencyStatusesEligibleForClosure = [
  "active",
  "from-api-PE",
] as const satisfies AgencyStatus[];

const agencyKindsEligibleForClosure = [
  "mission-locale",
  "cap-emploi",
  "conseil-departemental",
  "structure-IAE",
  "fonction-publique",
  "cci",
  "cma",
  "chambre-agriculture",
  "autre",
] as const satisfies AgencyKind[];

const conventionStatusesPreventingAgencyClosure = conventionStatuses.filter(
  (status): status is Exclude<ConventionStatus, UnvalidatedConventionStatus> =>
    !isUnvalidatedConventionStatus(status),
);

export const makeInactiveAgenciesFilters = (params: {
  updatedAtBefore: Date;
}): GetAgenciesFilters => ({
  status: [...agencyStatusesEligibleForClosure],
  kinds: [...agencyKindsEligibleForClosure],
  updatedAtBefore: params.updatedAtBefore,
});

export const getInactiveAgenciesAmong = async (params: {
  agencies: AgencyWithUsersRights[];
  uow: UnitOfWork;
  noConventionSince: Date;
}): Promise<AgencyWithUsersRights[]> => {
  const { agencies, uow, noConventionSince } = params;

  const inactiveAgenciesResults = await executeInSequence(
    agencies,
    async (agency): Promise<AgencyWithUsersRights | null> => {
      const agencyConventionIds =
        await uow.conventionQueries.getConventionIdsByFilters({
          filters: {
            withAgencyIds: [agency.id],
            withStatuses: [...conventionStatusesPreventingAgencyClosure],
            withDateSubmission: { from: noConventionSince },
          },
          limit: 1,
        });

      if (agencyConventionIds.length === 0) {
        const referringAgencies =
          await uow.agencyRepository.getAgenciesRelatedToAgency(agency.id);

        if (referringAgencies.length === 0) return agency;

        const referringAgenciesConventionIds =
          await uow.conventionQueries.getConventionIdsByFilters({
            filters: {
              withAgencyIds: referringAgencies.map(
                (referringAgency) => referringAgency.id,
              ),
              withStatuses: [...conventionStatusesPreventingAgencyClosure],
              withDateSubmission: { from: noConventionSince },
            },
            limit: 1,
          });

        if (referringAgenciesConventionIds.length === 0) return agency;
      }

      return null;
    },
  );

  return inactiveAgenciesResults.filter(isTruthy);
};

export const doesWarnedAgencyRequiresWarningAgain = async (params: {
  agency: AgencyWithUsersRights;
  warningCreatedAt: Date;
  uow: UnitOfWork;
}): Promise<boolean> => {
  const { agency, warningCreatedAt, uow } = params;

  const isAgencyUpdatedAfterLastWarning =
    startOfDay(new Date(agency.updatedAt)) >= startOfDay(warningCreatedAt);
  if (isAgencyUpdatedAfterLastWarning) {
    return false;
  }

  const conventionIdsAfterWarning =
    await uow.conventionQueries.getConventionIdsByFilters({
      filters: {
        withAgencyIds: [agency.id],
        withStatuses: [...conventionStatusesPreventingAgencyClosure],
        withDateSubmission: { from: warningCreatedAt },
      },
      limit: 1,
    });

  return conventionIdsAfterWarning.length === 0;
};
