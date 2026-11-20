import {
  type AdminEventListItemDto,
  type ConnectedUser,
  type DataWithPagination,
  type GetEventsForAdminParams,
  getEventsForAdminParamsSchema,
  getPaginationParamsForWeb,
  type TriggeredBy,
  withTriggeredBySchema,
} from "shared";
import { throwIfNotAdmin } from "../../../connected-users/helpers/authorization.helper";
import { useCaseBuilder } from "../../useCaseBuilder";
import type { DomainEvent } from "../events";

export type GetEventsForAdmin = ReturnType<typeof makeGetEventsForAdmin>;

export const makeGetEventsForAdmin = useCaseBuilder("GetEventsForAdmin")
  .withInput<GetEventsForAdminParams>(getEventsForAdminParamsSchema)
  .withOutput<DataWithPagination<AdminEventListItemDto>>()
  .withCurrentUser<ConnectedUser>()
  .build(
    async ({ inputParams: { search, page, perPage }, uow, currentUser }) => {
      throwIfNotAdmin(currentUser);

      const { data, pagination } = await uow.outboxQueries.searchEvents({
        search,
        pagination: getPaginationParamsForWeb({ page, perPage }),
      });

      return { data: data.map(toAdminEventListItemDto), pagination };
    },
  );

const getTriggeredBy = (payload: unknown): TriggeredBy | null => {
  const result = withTriggeredBySchema.safeParse(payload);
  return result.success ? result.data.triggeredBy : null;
};

const toAdminEventListItemDto = (
  event: DomainEvent,
): AdminEventListItemDto => ({
  id: event.id,
  occurredAt: event.occurredAt,
  topic: event.topic,
  status: event.status,
  wasQuarantined: event.wasQuarantined,
  triggeredBy: getTriggeredBy(event.payload),
  payload: event.payload,
  publications: event.publications,
});
