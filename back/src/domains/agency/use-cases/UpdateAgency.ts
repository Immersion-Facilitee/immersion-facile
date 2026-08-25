import {
  type AgencyDto,
  type AgencyStatus,
  type AgencyUsersRights,
  agencySchema,
  type ConnectedUser,
  closedOrRejectedAgencyStatuses,
  errors,
  settableAgencyStatusesThroughUpdate,
} from "shared";
import { validateAgencyRights } from "../../connected-users/helpers/agencyRights.helper";
import {
  throwIfNotAdmin,
  throwIfNotAgencyAdminOrBackofficeAdmin,
} from "../../connected-users/helpers/authorization.helper";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";
import type { PartialAgencyWithUsersRights } from "../ports/AgencyRepository";

const hasAgencyAdmin = (usersRights: AgencyUsersRights): boolean =>
  Object.values(usersRights).some((right) =>
    right?.roles.includes("agency-admin"),
  );

const statusChangedEventTopicByStatus: Partial<
  Record<AgencyStatus, "AgencyActivated" | "AgencyRejected">
> = {
  active: "AgencyActivated",
  "from-api-PE": "AgencyActivated",
  rejected: "AgencyRejected",
};

const getStatusChangedEventTopic = (
  previousStatus: AgencyStatus,
  nextStatus: AgencyStatus,
): "AgencyActivated" | "AgencyRejected" | undefined =>
  previousStatus === nextStatus
    ? undefined
    : statusChangedEventTopicByStatus[nextStatus];

const toAgencyForRepositoryUpdate = (
  agency: AgencyDto,
  now: Date,
): PartialAgencyWithUsersRights => {
  const {
    validatorEmails: _,
    counsellorEmails: __,
    ...agencyToUpdate
  } = agency;

  return {
    ...agencyToUpdate,
    statusJustification: closedOrRejectedAgencyStatuses.includes(agency.status)
      ? agency.statusJustification
      : null,
    updatedAt: now.toISOString(),
  };
};

export type UpdateAgency = ReturnType<typeof makeUpdateAgency>;
export const makeUpdateAgency = useCaseBuilder("UpdateAgency")
  .withInput(agencySchema)
  .withCurrentUser<ConnectedUser>()
  .withDeps<{ createNewEvent: CreateNewEvent; timeGateway: TimeGateway }>()
  .build(async ({ uow, currentUser, deps, inputParams: agency }) => {
    const existingAgency = await uow.agencyRepository.getById(agency.id);
    if (!existingAgency) throw errors.agency.notFound({ agencyId: agency.id });

    const statusChanged = existingAgency.status !== agency.status;
    const statusChangedEventTopic = getStatusChangedEventTopic(
      existingAgency.status,
      agency.status,
    );

    if (statusChanged) throwIfNotAdmin(currentUser);
    else
      throwIfNotAgencyAdminOrBackofficeAdmin({
        agencyIds: [agency.id],
        currentUser,
      });

    if (
      statusChanged &&
      !settableAgencyStatusesThroughUpdate.includes(agency.status)
    )
      throw errors.agency.cannotUpdateToStatus({
        agencyId: agency.id,
        status: agency.status,
      });

    if (statusChangedEventTopic === "AgencyActivated") {
      if (!hasAgencyAdmin(existingAgency.usersRights))
        throw errors.agency.cannotActivateWithoutAdmin({ agencyId: agency.id });

      validateAgencyRights(
        agency.id,
        existingAgency.usersRights,
        existingAgency.refersToAgencyId,
      );
    }

    await uow.agencyRepository.update(
      toAgencyForRepositoryUpdate(agency, deps.timeGateway.now()),
    );

    const triggeredBy = {
      kind: "connected-user" as const,
      userId: currentUser.id,
    };

    await uow.outboxRepository.save(
      deps.createNewEvent({
        topic: "AgencyUpdated",
        payload: { agencyId: agency.id, triggeredBy },
      }),
    );

    if (statusChangedEventTopic)
      await uow.outboxRepository.save(
        deps.createNewEvent({
          topic: statusChangedEventTopic,
          payload: { agencyId: agency.id, triggeredBy },
        }),
      );
  });
