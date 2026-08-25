import type { AgencyKind, UserId } from "shared";
import { agencyKindSchema, executeInSequence, userIdSchema } from "shared";
import { z } from "zod";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";

type AssignAgencyViewerRoleInput = {
  userIds: UserId[];
  agencyKinds: AgencyKind[];
};

type AssignAgencyViewerRoleOutput = {
  agenciesSuccessfullyUpdated: number;
  agencyUpdatesFailed: number;
  agenciesSkipped: number;
};

const assignAgencyViewerRoleInputSchema = z.object({
  userIds: z.array(userIdSchema),
  agencyKinds: z.array(agencyKindSchema),
});

export type AssignAgencyViewerRole = ReturnType<
  typeof makeAssignAgencyViewerRole
>;

export const makeAssignAgencyViewerRole = useCaseBuilder(
  "AssignAgencyViewerRole",
)
  .withInput<AssignAgencyViewerRoleInput>(assignAgencyViewerRoleInputSchema)
  .withOutput<AssignAgencyViewerRoleOutput>()
  .withDeps<{ timeGateway: TimeGateway }>()
  .build(async ({ inputParams: { agencyKinds, userIds }, uow, deps }) => {
    const users = await uow.userRepository.getByIds(userIds);

    if (users.length === 0) {
      return {
        agenciesSuccessfullyUpdated: 0,
        agencyUpdatesFailed: 0,
        agenciesSkipped: 0,
      };
    }

    const { data: targetAgencies } = await uow.agencyRepository.getAgencies({
      filters: {
        kinds: agencyKinds,
        status: ["active", "from-api-PE"],
      },
    });

    let agenciesSuccessfullyUpdated = 0;
    let agencyUpdatesFailed = 0;
    let agenciesSkipped = 0;

    await executeInSequence(targetAgencies, async (agency) => {
      const updatedUsersRights = { ...agency.usersRights };
      let hasChanges = false;

      users.forEach((user) => {
        const existingRight = agency.usersRights[user.id];

        if (existingRight?.roles.includes("agency-viewer")) {
          return;
        }

        updatedUsersRights[user.id] = existingRight
          ? {
              roles: [...existingRight.roles, "agency-viewer"],
              isNotifiedByEmail: existingRight.isNotifiedByEmail,
            }
          : {
              roles: ["agency-viewer"],
              isNotifiedByEmail: false,
            };

        hasChanges = true;
      });

      if (hasChanges) {
        return uow.agencyRepository
          .update({
            id: agency.id,
            status: agency.status,
            usersRights: updatedUsersRights,
            updatedAt: deps.timeGateway.now().toISOString(),
          })
          .then(() => {
            agenciesSuccessfullyUpdated++;
          })
          .catch((error) => {
            agencyUpdatesFailed++;
            console.error(
              `Failed to update agency ${agency.id} with user rights:`,
              error,
            );
          });
      }
      agenciesSkipped++;
    });

    return {
      agenciesSuccessfullyUpdated,
      agencyUpdatesFailed,
      agenciesSkipped,
    };
  });
