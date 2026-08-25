import { partition } from "ramda";
import {
  type AgencyGroup,
  type AgencyRight,
  type AgencyWithUsersRights,
  activeAgencyStatuses,
  agencyRoleIsNotToReview,
  executeInSequence,
  toAgencyDtoForAgencyUsersAndAdmins,
  type UserWithRights,
  type ZodSchemaWithInputMatchingOutput,
} from "shared";
import { z } from "zod";
import {
  getAgencyAndAdminEmailsByAgencyId,
  updateRightsOnMultipleAgenciesForUser,
} from "../../../utils/agency";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import type { UnitOfWork } from "../../core/unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import { getUserWithRights } from "../helpers/userRights.helper";

export type UserAuthenticatedPayload = {
  userId: string;
  codeSafir: string | null; // Code safir non stocké en DB côté utilisateur
};

const userAuthenticatedSchema: ZodSchemaWithInputMatchingOutput<UserAuthenticatedPayload> =
  z.object({
    userId: z.string(),
    codeSafir: z.string().or(z.null()),
  });

export type LinkFranceTravailUsersToTheirAgencies = ReturnType<
  typeof makeLinkFranceTravailUsersToTheirAgencies
>;
export const makeLinkFranceTravailUsersToTheirAgencies = useCaseBuilder(
  "LinkFranceTravailUsersToTheirAgencies",
)
  .withInput(userAuthenticatedSchema)
  .withOutput<void>()
  .withDeps<{
    createNewEvent: CreateNewEvent;
    timeGateway: TimeGateway;
  }>()
  .build(async ({ uow, deps, inputParams: { userId, codeSafir } }) => {
    if (!codeSafir) return;
    const user = await getUserWithRights(uow, userId);
    if (isIcUserAlreadyHasValidRight(user, codeSafir)) return;

    const agenciesWithSafir =
      await uow.agencyRepository.getBySafirAndActiveStatus(codeSafir);
    const now = deps.timeGateway.now();

    if (agenciesWithSafir.length) {
      await executeInSequence(agenciesWithSafir, (agencyWithSafir) =>
        updateActiveAgencyWithSafir(
          uow,
          agencyWithSafir,
          userId,
          deps.createNewEvent,
          now,
        ),
      );
      return;
    }

    const groupWithSafir =
      await uow.agencyGroupRepository.getByCodeSafir(codeSafir);
    if (groupWithSafir)
      return updateAgenciesOfGroup(uow, groupWithSafir, user, now);
  });

const isIcUserAlreadyHasValidRight = (
  userWithRights: UserWithRights,
  codeSafir: string,
): boolean =>
  userWithRights.agencyRights.some(
    ({ agency, roles }) =>
      agency.codeSafir === codeSafir && agencyRoleIsNotToReview(roles),
  );

const updateActiveAgencyWithSafir = async (
  uow: UnitOfWork,
  agencyWithSafir: AgencyWithUsersRights,
  userId: string,
  createNewEvent: CreateNewEvent,
  now: Date,
): Promise<void> => {
  await uow.agencyRepository.update({
    id: agencyWithSafir.id,
    status: agencyWithSafir.status,
    usersRights: {
      ...agencyWithSafir.usersRights,
      [userId]: { roles: ["validator"], isNotifiedByEmail: false },
    },
    updatedAt: now.toISOString(),
  });
  await uow.outboxRepository.save(
    createNewEvent({
      topic: "AgencyUpdated",
      payload: {
        agencyId: agencyWithSafir.id,
        triggeredBy: {
          kind: "crawler",
        },
      },
    }),
  );
};

const updateAgenciesOfGroup = async (
  uow: UnitOfWork,
  agencyGroupWithSafir: AgencyGroup,
  user: UserWithRights,
  now: Date,
): Promise<void> => {
  const agenciesRelatedToGroup = await uow.agencyRepository.getByIds(
    agencyGroupWithSafir.agencyIds,
  );

  const [agencyRightsWithConflicts, agencyRightsWithoutConflicts] = partition(
    ({ agency }) => agencyGroupWithSafir.agencyIds.includes(agency.id),
    user.agencyRights,
  );

  const agenciesWithAdminEmailsById = await getAgencyAndAdminEmailsByAgencyId({
    uow,
    agencyIds: agenciesRelatedToGroup.map(({ id }) => id),
  });

  const otherAgencyRights = await Promise.all(
    agenciesRelatedToGroup
      .filter((agency) => activeAgencyStatuses.includes(agency.status))
      .map(async (agency): Promise<AgencyRight> => {
        const existingAgencyRight = agencyRightsWithConflicts.find(
          (agencyRight) => agencyRight.agency.id === agency.id,
        );

        if (
          existingAgencyRight &&
          agencyRoleIsNotToReview(existingAgencyRight.roles)
        )
          return existingAgencyRight;

        return {
          agency: toAgencyDtoForAgencyUsersAndAdmins(
            agency,
            agenciesWithAdminEmailsById[agency.id].adminEmails,
          ),
          roles: ["agency-viewer"],
          isNotifiedByEmail: false,
        };
      }),
  );

  const agencyRightsForUser: AgencyRight[] = [
    ...agencyRightsWithoutConflicts,
    ...otherAgencyRights,
  ];

  return updateRightsOnMultipleAgenciesForUser({
    uow,
    userId: user.id,
    agenciesRightForUser: agencyRightsForUser,
    now,
  });
};
