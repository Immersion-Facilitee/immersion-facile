import { toPairs, uniq } from "ramda";
import {
  type AgencyUsersRights,
  type AgencyWithUsersRights,
  errors,
  executeInSequence,
  keys,
  withAgencyIdSchema,
} from "shared";
import type { CreateNewEvent } from "../../core/events/ports/EventBus";
import type { TimeGateway } from "../../core/time-gateway/ports/TimeGateway";
import { useCaseBuilder } from "../../core/useCaseBuilder";

export type UpdateAgencyReferringToUpdatedAgency = ReturnType<
  typeof makeUpdateAgencyReferringToUpdatedAgency
>;
export const makeUpdateAgencyReferringToUpdatedAgency = useCaseBuilder(
  "UpdateAgencyReferringToUpdatedAgency",
)
  .withInput(withAgencyIdSchema)
  .withDeps<{ createNewEvent: CreateNewEvent; timeGateway: TimeGateway }>()
  .build(async ({ uow, deps, inputParams }) => {
    const updatedAgency = await uow.agencyRepository.getById(
      inputParams.agencyId,
    );

    if (!updatedAgency) throw errors.agency.notFound(inputParams);

    const relatedAgencies =
      await uow.agencyRepository.getAgenciesRelatedToAgency(updatedAgency.id);

    await executeInSequence(
      relatedAgencies,
      async ({ usersRights, status, id }) => {
        await uow.agencyRepository.update({
          id,
          status,
          usersRights: updateRights(usersRights, updatedAgency),
          updatedAt: deps.timeGateway.now().toISOString(),
        });
        await uow.outboxRepository.save(
          deps.createNewEvent({
            topic: "AgencyUpdated",
            payload: {
              agencyId: id,
              triggeredBy: {
                kind: "crawler",
              },
            },
          }),
        );
      },
    );
  });

const updateRights = (
  rightsOfRelatedAgency: AgencyUsersRights,
  updatedAgency: AgencyWithUsersRights,
): AgencyUsersRights => {
  const validatorsOfUpdatedAgency = toPairs(updatedAgency.usersRights)
    .filter(([_, rights]) => rights?.roles.includes("validator"))
    .map(([id, rights]) => ({
      id,
      isNotifiedByEmail: rights?.isNotifiedByEmail,
    }));

  //TODO: de tête on a un utilitaire qui fait 2 en 1 ici
  const idsToUpdate = validatorsOfUpdatedAgency.filter(({ id }) =>
    keys(rightsOfRelatedAgency).includes(id),
  );
  const idsToAdd = validatorsOfUpdatedAgency.filter(
    ({ id }) => !keys(rightsOfRelatedAgency).includes(id),
  );
  const idsToRemove = toPairs(rightsOfRelatedAgency)
    .filter(
      ([id, rights]) =>
        rights?.roles.includes("validator") &&
        !validatorsOfUpdatedAgency.some((validator) => validator.id === id),
    )
    .map(([id]) => id);

  return {
    ...toPairs(rightsOfRelatedAgency).reduce<AgencyUsersRights>(
      (acc, [id, right]) => {
        const idToUpdate = idsToUpdate.find(
          (idToUpdate) => idToUpdate.id === id,
        );
        const isIdToRemove = idsToRemove.find(
          (idToRemove) => idToRemove === id,
        );
        return isIdToRemove
          ? acc
          : {
              ...acc,
              [id]:
                right && idToUpdate
                  ? {
                      isNotifiedByEmail: idToUpdate.isNotifiedByEmail,
                      roles: uniq([...right.roles, "validator"]),
                    }
                  : right,
            };
      },
      {},
    ),
    ...idsToAdd.reduce<AgencyUsersRights>(
      (acc, idsToAdd) => ({
        ...acc,
        [idsToAdd.id]: {
          isNotifiedByEmail: idsToAdd.isNotifiedByEmail,
          roles: ["validator"],
        },
      }),
      {},
    ),
  };
};
