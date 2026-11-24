import { uniq } from "ramda";
import {
  type AdminEventListItemDto,
  type AdminEventTriggeredBy,
  type ConnectedUser,
  type DataWithPagination,
  type Email,
  type GetEventsForAdminParams,
  getEventsForAdminParamsSchema,
  getPaginationParamsForWeb,
  type TriggeredBy,
  type UserId,
  withTriggeredBySchema,
} from "shared";
import { throwIfNotAdmin } from "../../../connected-users/helpers/authorization.helper";
import type { UnitOfWork } from "../../unit-of-work/ports/UnitOfWork";
import { useCaseBuilder } from "../../useCaseBuilder";
import type { DomainEvent } from "../events";

export type GetEventsForAdmin = ReturnType<typeof makeGetEventsForAdmin>;

type EmailByUserId = Partial<Record<UserId, Email>>;

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

      const eventsWithTriggeredBy = data.map((event) => ({
        event,
        triggeredBy: getTriggeredBy(event.payload),
      }));

      const emailByUserId = await getEmailByUserId(
        uow,
        eventsWithTriggeredBy.map(({ triggeredBy }) => triggeredBy),
      );

      return {
        data: eventsWithTriggeredBy.map(({ event, triggeredBy }) =>
          toAdminEventListItemDto(
            event,
            toAdminEventTriggeredBy(triggeredBy, emailByUserId),
          ),
        ),
        pagination,
      };
    },
  );

const getTriggeredBy = (payload: unknown): TriggeredBy | null => {
  const result = withTriggeredBySchema.safeParse(payload);
  return result.success ? result.data.triggeredBy : null;
};

const getEmailByUserId = async (
  uow: UnitOfWork,
  triggeredBys: (TriggeredBy | null)[],
): Promise<EmailByUserId> => {
  const userIds = uniq(
    triggeredBys.flatMap((triggeredBy) =>
      triggeredBy?.kind === "connected-user" ? [triggeredBy.userId] : [],
    ),
  );
  const users = await Promise.all(
    userIds.map((userId) => uow.userRepository.getById(userId)),
  );
  return Object.fromEntries(
    users.flatMap((user) => (user ? [[user.id, user.email]] : [])),
  );
};

const toAdminEventTriggeredBy = (
  triggeredBy: TriggeredBy | null,
  emailByUserId: EmailByUserId,
): AdminEventTriggeredBy | null =>
  triggeredBy?.kind === "connected-user"
    ? { ...triggeredBy, email: emailByUserId[triggeredBy.userId] ?? null }
    : triggeredBy;

const toAdminEventListItemDto = (
  event: DomainEvent,
  triggeredBy: AdminEventTriggeredBy | null,
): AdminEventListItemDto => ({
  id: event.id,
  occurredAt: event.occurredAt,
  topic: event.topic,
  status: event.status,
  wasQuarantined: event.wasQuarantined,
  triggeredBy,
  payload: event.payload,
  publications: event.publications,
});
