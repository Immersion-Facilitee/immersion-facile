import { fr } from "@codegouvfr/react-dsfr";
import type { AlertProps } from "@codegouvfr/react-dsfr/Alert";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useEffect, useState } from "react";
import { RichTable } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AdminEventListItemDto,
  defaultPerPageInWebPagination,
  domElementIds,
  type EventStatus,
  frontRoutes,
  type TriggeredBy,
  titleByRole,
  toDisplayedDate,
} from "shared";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { adminEventListSelectors } from "src/core-logic/domain/admin/adminEventList/adminEventList.selectors";
import { adminEventListSlice } from "src/core-logic/domain/admin/adminEventList/adminEventList.slice";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";

const feedbackTopic: FeedbackTopic = "admin-event-list";

const eventDetailsModal = createModal({
  isOpenedByDefault: false,
  id: domElementIds.adminEvents.eventDetailsModal,
});

const eventStatusToLabel: Record<EventStatus, string> = {
  "never-published": "Jamais publié",
  "to-republish": "À republier",
  "in-process": "En cours",
  published: "Publié",
  "failed-but-will-retry": "En échec, sera rejoué",
  "failed-to-many-times": "En échec définitif",
};

const eventStatusToSeverity: Record<EventStatus, AlertProps.Severity> = {
  "never-published": "info",
  "to-republish": "info",
  "in-process": "info",
  published: "success",
  "failed-but-will-retry": "warning",
  "failed-to-many-times": "error",
};

const toResultCountLabel = (totalRecords: number): string =>
  totalRecords <= 1
    ? `${totalRecords} événement`
    : `${totalRecords} événements`;

export const AdminEventListSection = (): React.ReactNode => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const isLoading = useAppSelector(adminEventListSelectors.isLoading);
  const {
    data: events,
    pagination,
    filters,
  } = useAppSelector(adminEventListSelectors.adminEventList);
  const [selectedEvent, setSelectedEvent] =
    useState<AdminEventListItemDto | null>(null);

  useEffect(
    () => () => {
      dispatch(adminEventListSlice.actions.clearAdminEventListRequested());
    },
    [dispatch],
  );

  if (!connectedUserJwt) return null;

  const hasSearch = filters.search !== "";

  const searchEvents = (query: string): void => {
    const search = query.trim();
    if (search === filters.search) return;
    if (!search) {
      dispatch(adminEventListSlice.actions.clearAdminEventListRequested());
      return;
    }
    dispatch(
      adminEventListSlice.actions.fetchAdminEventListRequested({
        jwt: connectedUserJwt,
        filters: { search, page: 1, perPage: defaultPerPageInWebPagination },
        feedbackTopic,
      }),
    );
  };

  const openEventDetails = (event: AdminEventListItemDto): void => {
    setSelectedEvent(event);
    eventDetailsModal.open();
  };

  return (
    <BackofficeDashboardTabContent
      title="Événements"
      description="Événements liés à l'identifiant recherché, du plus récent au plus ancien."
    >
      <WithFeedbackReplacer topic={feedbackTopic}>
        {hasSearch && (
          <p className={fr.cx("fr-text--sm", "fr-mb-2w")}>
            {toResultCountLabel(pagination.totalRecords)}
          </p>
        )}
        <RichTable
          label="Liste des événements"
          hasViewSwitch={false}
          isLoading={isLoading}
          searchBar={{
            label: "Rechercher",
            placeholder: "ID de convention, ID d'agence ou SIRET",
            hintText:
              "La valeur doit être complète : identifiant de convention, d'agence ou de l'objet porté par l'événement (notification…), ou SIRET.",
            onSubmit: searchEvents,
          }}
          headers={
            events.length > 0
              ? [
                  { content: "Date" },
                  { content: "Sujet" },
                  { content: "Statut" },
                  { content: "Déclenché par" },
                  { content: "Échecs" },
                  { content: "Actions" },
                ]
              : [
                  {
                    content: hasSearch
                      ? `Aucun événement trouvé pour « ${filters.search} ».`
                      : "Saisissez un identifiant ou un SIRET complet pour afficher les événements correspondants.",
                  },
                ]
          }
          tableData={events.map((event) =>
            makeAdminEventListLine(event, openEventDetails),
          )}
          pagination={{
            count: pagination.totalPages,
            defaultPage: pagination.currentPage,
            showFirstLast: true,
            getPageLinkProps: (pageNumber) => ({
              title: `Résultats de recherche, page : ${pageNumber}`,
              onClick: (event) => {
                event.preventDefault();
                dispatch(
                  adminEventListSlice.actions.fetchAdminEventListRequested({
                    jwt: connectedUserJwt,
                    filters: { ...filters, page: pageNumber },
                    feedbackTopic,
                  }),
                );
              },
              href: "#",
              key: `pagination-link-${pageNumber}`,
            }),
          }}
        />
      </WithFeedbackReplacer>
      <eventDetailsModal.Component
        title={selectedEvent?.topic ?? "Détail de l'événement"}
        size="large"
      >
        {selectedEvent && <AdminEventDetails event={selectedEvent} />}
      </eventDetailsModal.Component>
    </BackofficeDashboardTabContent>
  );
};

const toLastPublicationFailuresCount = (event: AdminEventListItemDto): number =>
  event.publications.at(-1)?.failures.length ?? 0;

const makeAdminEventListLine = (
  event: AdminEventListItemDto,
  onShowDetails: (event: AdminEventListItemDto) => void,
): React.ReactNode[] => [
  toDisplayedDate({ date: new Date(event.occurredAt), withHours: true }),
  <strong key={`${event.id}-topic`}>{event.topic}</strong>,
  <AdminEventStatusBadges key={`${event.id}-status`} event={event} />,
  <TriggeredByLabel
    key={`${event.id}-triggered-by`}
    triggeredBy={event.triggeredBy}
  />,
  toLastPublicationFailuresCount(event) || "",
  <Button
    key={`${event.id}-actions`}
    id={`${domElementIds.adminEvents.eventListShowDetailsButton}--${event.id}`}
    size="small"
    priority="secondary"
    onClick={() => onShowDetails(event)}
  >
    Voir le détail
  </Button>,
];

const AdminEventStatusBadges = ({
  event,
}: {
  event: AdminEventListItemDto;
}): React.ReactNode => (
  <>
    <Badge noIcon severity={eventStatusToSeverity[event.status]} small>
      {eventStatusToLabel[event.status]}
    </Badge>
    {event.wasQuarantined && (
      <Badge noIcon severity="error" small className={fr.cx("fr-ml-1v")}>
        Mis en quarantaine
      </Badge>
    )}
  </>
);

const TriggeredByLabel = ({
  triggeredBy,
}: {
  triggeredBy: TriggeredBy | null;
}): React.ReactNode => {
  if (!triggeredBy) return "";
  if (triggeredBy.kind === "crawler") return "Tâche automatique";
  if (triggeredBy.kind === "convention-magic-link")
    return `Lien magique (${titleByRole[triggeredBy.role]})`;
  return (
    <a
      {...frontRoutes.adminUserDetail({ userId: triggeredBy.userId }).link}
      target="_blank"
    >
      {triggeredBy.userId}
    </a>
  );
};

const AdminEventDetails = ({
  event,
}: {
  event: AdminEventListItemDto;
}): React.ReactNode => (
  <>
    <p className={fr.cx("fr-text--sm", "fr-mb-1w")}>
      ID : {event.id}
      <br />
      Date :{" "}
      {toDisplayedDate({ date: new Date(event.occurredAt), withHours: true })}
    </p>
    <AdminEventStatusBadges event={event} />
    <h2 className={fr.cx("fr-h6", "fr-mt-3w", "fr-mb-1w")}>Publications</h2>
    {event.publications.length === 0 ? (
      <p className={fr.cx("fr-text--sm")}>Aucune publication</p>
    ) : (
      <ul className={fr.cx("fr-text--sm")}>
        {event.publications.map(({ publishedAt, failures }) => (
          <li key={publishedAt}>
            {toDisplayedDate({ date: new Date(publishedAt), withHours: true })}
            {failures.length === 0
              ? " : succès"
              : ` : ${failures.length} échec(s)`}
            {failures.length > 0 && (
              <ul>
                {failures.map(({ subscriptionId, errorMessage }) => (
                  <li key={subscriptionId}>
                    <strong>{subscriptionId}</strong> : {errorMessage}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    )}
    <h2 className={fr.cx("fr-h6", "fr-mt-3w", "fr-mb-1w")}>Payload</h2>
    <pre className={fr.cx("fr-text--xs")}>
      {JSON.stringify(event.payload, null, 2)}
    </pre>
  </>
);
