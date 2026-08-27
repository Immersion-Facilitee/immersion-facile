import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import Checkbox, { type CheckboxProps } from "@codegouvfr/react-dsfr/Checkbox";
import RadioButtons, {
  type RadioButtonsProps,
} from "@codegouvfr/react-dsfr/RadioButtons";
import { equals, pick } from "ramda";
import { Fragment, useEffect, useMemo, useState } from "react";
import { HeadingSection, RichTable } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type ConnectedUserJwt,
  type DataWithPagination,
  type DiscussionInList,
  type DiscussionOrderDirection,
  type DiscussionStatus,
  defaultPerPageInWebPagination,
  discussionStatuses,
  domElementIds,
  type ExchangeRole,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  toDisplayedDate,
  toDisplayedPhoneNumber,
} from "shared";
import { DiscussionFollowUpBadge } from "src/app/components/establishment/establishment-dashboard/DiscussionFollowUpBadge";
import { DiscussionStatusBadge } from "src/app/components/establishment/establishment-dashboard/DiscussionStatusBadge";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { MetabaseFullScreenButton } from "src/app/components/MetabaseFullScreenButton";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { discussionSelectors } from "src/core-logic/domain/discussion/discussion.selectors";
import {
  discussionSlice,
  type FlatGetPaginatedDiscussionsParamsWithStatusesAsArray,
  initialDiscussionsWithPagination,
} from "src/core-logic/domain/discussion/discussion.slice";
import { match, P } from "ts-pattern";

export const DiscussionList = ({ viewer }: { viewer: ExchangeRole }) => {
  const dispatch = useDispatch();
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const {
    data: discussions,
    pagination,
    filters,
  } = useAppSelector(discussionSelectors.discussionsWithPagination);
  const isLoading = useAppSelector(discussionSelectors.isLoading);
  const defaultFilters = useMemo(
    () =>
      pick(
        ["orderBy", "orderDirection", "statuses", "search"],
        initialDiscussionsWithPagination.filters,
      ),
    [],
  );
  const [tempFilters, setTempFilters] =
    useState<
      Pick<
        FlatGetPaginatedDiscussionsParamsWithStatusesAsArray,
        "statuses" | "orderBy" | "orderDirection" | "search"
      >
    >(defaultFilters);

  const statusOptions: CheckboxProps["options"] = useMemo(() => {
    return discussionStatuses.map((status) => ({
      label: displayedStatuses[status],
      nativeInputProps: {
        value: status,
        onChange: (event) => {
          const existingStatuses = tempFilters.statuses ?? [];
          setTempFilters({
            ...tempFilters,
            statuses:
              event.currentTarget.checked &&
              isStringDiscussionStatus(event.currentTarget.value)
                ? [...existingStatuses, event.currentTarget.value]
                : existingStatuses.filter(
                    (status) => status !== event.currentTarget.value,
                  ),
          });
        },
      },
    }));
  }, [tempFilters]);

  const dateOptions: RadioButtonsProps["options"] = useMemo(() => {
    return Object.entries(displayedOrderDirections).map(
      ([orderDirection, label]) => ({
        label,
        nativeInputProps: {
          value: orderDirection,
          defaultChecked: orderDirection === filters.orderDirection,
          onChange: () => {
            setTempFilters({
              ...tempFilters,
              orderDirection: orderDirection as DiscussionOrderDirection,
            });
          },
        },
      }),
    );
  }, [tempFilters, filters]);
  useEffect(() => {
    if (connectedUserJwt) {
      dispatch(
        discussionSlice.actions.fetchDiscussionListRequested({
          jwt: connectedUserJwt,
          filters: {
            ...initialDiscussionsWithPagination.filters,
            userRole: viewer,
          },
          feedbackTopic: "establishment-dashboard-discussion-list",
        }),
      );
    }
  }, [connectedUserJwt, dispatch, viewer]);
  if (!connectedUserJwt) {
    return;
  }

  return (
    <HeadingSection
      title="Candidatures"
      titleAs="h2"
      className={fr.cx("fr-mt-0")}
      titleAction={
        viewer === "establishment" &&
        currentUser?.dashboards.establishments.discussions ? (
          <MetabaseFullScreenButton
            url={currentUser.dashboards.establishments.discussions}
            label="Voir l'ancien tableau"
          />
        ) : null
      }
    >
      <WithFeedbackReplacer topic="establishment-dashboard-discussion-list">
        {match({
          filteredDiscussions: discussions.filter(
            (discussion) => !discussion.isEstablishmentBanned,
          ),
          viewer,
        })

          .with({ discussions: P.nullish, viewer: "establishment" }, () => (
            <p>
              Nous n'avons pas trouvé de candidatures où vous êtes référencé en
              tant que contact d'entreprise.
            </p>
          ))
          .with(
            { discussions: P.nullish, viewer: "potentialBeneficiary" },
            () => (
              <p>
                Nous n'avons pas trouvé de candidatures envoyées avec votre
                adresse email.
              </p>
            ),
          )
          .with(
            { filteredDiscussions: P.not(P.nullish), viewer: "establishment" },
            ({ filteredDiscussions }) => (
              <EstablishmentDiscussionTable
                discussions={filteredDiscussions}
                filters={filters}
                isLoading={isLoading}
                connectedUserJwt={connectedUserJwt}
                tempFilters={{ ...tempFilters, userRole: viewer }}
                statusOptions={statusOptions}
                dateOptions={dateOptions}
                pagination={pagination}
              />
            ),
          )
          .with(
            {
              filteredDiscussions: P.not(P.nullish),
              viewer: "potentialBeneficiary",
            },
            ({ filteredDiscussions }) => (
              <BeneficiaryDiscussionTable
                discussions={filteredDiscussions}
                filters={filters}
                isLoading={isLoading}
                connectedUserJwt={connectedUserJwt}
                pagination={pagination}
              />
            ),
          )
          .exhaustive()}
      </WithFeedbackReplacer>
    </HeadingSection>
  );
};

const displayedStatuses: Record<DiscussionStatus, string> = {
  ACCEPTED: "Acceptée",
  REJECTED: "Rejetée",
  PENDING: "En cours",
};

const displayedOrderDirections: Record<DiscussionOrderDirection, string> = {
  desc: "Du plus récent au plus ancien",
  asc: "Du plus ancien au plus récent",
};

const isStringDiscussionStatus = (value: string): value is DiscussionStatus => {
  return discussionStatuses.includes(value as DiscussionStatus);
};

const EstablishmentDiscussionTable = ({
  discussions,
  filters,
  isLoading,
  connectedUserJwt,
  pagination,
  tempFilters,
  statusOptions,
  dateOptions,
}: {
  discussions: DiscussionInList[];
  filters: FlatGetPaginatedDiscussionsParamsWithStatusesAsArray;
  isLoading: boolean;
  connectedUserJwt: ConnectedUserJwt;
  pagination: DataWithPagination<DiscussionInList>["pagination"];
  tempFilters: FlatGetPaginatedDiscussionsParamsWithStatusesAsArray;
  statusOptions: CheckboxProps["options"];
  dateOptions: RadioButtonsProps["options"];
}) => {
  const dispatch = useDispatch();
  const hasDiscussions = discussions.length > 0;
  const filtersAreEmpty = equals(
    filters,
    initialDiscussionsWithPagination.filters,
  );
  const getTableHeaders = () => {
    if (hasDiscussions) {
      return [
        "Offre d'immersion",
        "Candidat",
        "But de l'immersion",
        "Date",
        "Statut",
        "Actions",
      ];
    }
    if (!filtersAreEmpty) {
      return [
        "Aucune candidature trouvée avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche.",
      ];
    }
    return [
      "Nous n'avons pas trouvé de candidatures où vous êtes référencé en tant que contact d'entreprise.",
    ];
  };
  return (
    <RichTable
      headers={getTableHeaders()}
      className={fr.cx("fr-mt-4w")}
      isLoading={isLoading}
      data={discussions.map((discussion) => [
        <Fragment key={discussion.id}>
          <strong>{discussion.appellation.appellationLabel}</strong>
          <br />
          {discussion.businessName}
        </Fragment>,
        <Fragment key={discussion.id}>
          <strong>
            {getFormattedFirstnameAndLastname({
              firstname: discussion.potentialBeneficiary.firstName,
              lastname: discussion.potentialBeneficiary.lastName,
            })}
          </strong>
          <br />
          {discussion.potentialBeneficiary.phone
            ? toDisplayedPhoneNumber(discussion.potentialBeneficiary.phone)
            : "Non renseigné"}
        </Fragment>,
        discussion.immersionObjective,
        toDisplayedDate({
          date: new Date(discussion.createdAt),
          withHours: false,
        }),
        <>
          <DiscussionStatusBadge
            key={discussion.id}
            discussion={discussion}
            isEstablishmentReachableByPhoneAfter15Days={
              discussion.isEstablishmentReachableByPhoneAfter15Days
            }
            viewer={"establishment"}
            small
          />
          <DiscussionFollowUpBadge
            key={discussion.id}
            discussion={discussion}
            isEstablishmentReachableByPhoneAfter15Days={
              discussion.isEstablishmentReachableByPhoneAfter15Days
            }
            viewer={"establishment"}
            small
          />
        </>,
        <Button
          key={discussion.id}
          id={`${domElementIds.establishmentDashboard.manageDiscussion.goToDiscussionButton}--${discussion.id}`}
          size="small"
          priority="secondary"
          linkProps={{
            ...frontRoutes.establishmentDashboardDiscussions({
              discussionId: discussion.id,
            }).link,
          }}
        >
          Voir la candidature
        </Button>,
      ])}
      dropdownFilters={{
        items: [
          {
            id: "status",
            iconId: "fr-icon-equalizer-line" as const,
            defaultValue: "Tous les statuts",
            values: filters.statuses?.length
              ? [
                  `Statut : ${filters.statuses
                    .map((status) => displayedStatuses[status])
                    .join(", ")}`,
                ]
              : ["Tous les statuts"],
            submenu: {
              title: "Filtrer par statut",
              content: (
                <>
                  <Checkbox options={statusOptions} />
                </>
              ),
            },
          },
          {
            id: "date",
            iconId: "fr-icon-arrow-down-line" as const,
            defaultValue: "Du plus récent au plus ancien",
            values: [
              displayedOrderDirections[filters.orderDirection ?? "desc"],
            ],
            submenu: {
              title: "Trier par date",
              content: (
                <>
                  <RadioButtons options={dateOptions} />
                </>
              ),
            },
          },
        ],
        onSubmit: () => {
          dispatch(
            discussionSlice.actions.fetchDiscussionListRequested({
              jwt: connectedUserJwt,
              filters: {
                ...filters,
                ...tempFilters,
                page: 1,
                perPage: defaultPerPageInWebPagination,
              },
              feedbackTopic: "establishment-dashboard-discussion-list",
            }),
          );
        },
      }}
      searchBar={{
        label: "Rechercher",
        placeholder: "Rechercher",
        onSubmit: (query: string) => {
          dispatch(
            discussionSlice.actions.fetchDiscussionListRequested({
              jwt: connectedUserJwt,
              filters: {
                ...filters,
                search: query,
                page: 1,
              },
              feedbackTopic: "establishment-dashboard-discussion-list",
            }),
          );
        },
      }}
      pagination={{
        count: pagination.totalPages,
        defaultPage: pagination.currentPage,
        showFirstLast: true,
        getPageLinkProps: (pageNumber) => ({
          title: `Résultats de recherche, page : ${pageNumber}`,
          onClick: (event) => {
            event.preventDefault();
            dispatch(
              discussionSlice.actions.fetchDiscussionListRequested({
                jwt: connectedUserJwt,
                filters: { ...filters, page: pageNumber },
                feedbackTopic: "establishment-dashboard-discussion-list",
              }),
            );
          },
          href: "#",
          key: `pagination-link-${pageNumber}`,
        }),
      }}
    />
  );
};

const BeneficiaryDiscussionTable = ({
  discussions,
  filters,
  isLoading,
  connectedUserJwt,
  pagination,
}: {
  discussions: DiscussionInList[];
  filters: FlatGetPaginatedDiscussionsParamsWithStatusesAsArray;
  isLoading: boolean;
  connectedUserJwt: ConnectedUserJwt;
  pagination: DataWithPagination<DiscussionInList>["pagination"];
}) => {
  const dispatch = useDispatch();
  const hasDiscussions = discussions.length > 0;
  const filtersAreEmpty = equals(
    filters,
    initialDiscussionsWithPagination.filters,
  );
  const getTableHeaders = () => {
    if (hasDiscussions) {
      return ["Métier", "Nom d'entreprise", "Date", "Statut", "Actions"];
    }
    if (!filtersAreEmpty) {
      return [
        "Aucune candidature envoyée avec votre adresse email trouvée avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche.",
      ];
    }
    return [
      "Nous n'avons pas trouvé de candidatures envoyées avec votre adresse email.",
    ];
  };
  return (
    <RichTable
      headers={getTableHeaders()}
      isLoading={isLoading}
      data={discussions.map((discussion) => [
        <strong key={discussion.id}>
          {discussion.appellation.appellationLabel}
        </strong>,
        <strong key={discussion.id}>{discussion.businessName}</strong>,

        toDisplayedDate({
          date: new Date(discussion.createdAt),
          withHours: false,
        }),
        <DiscussionStatusBadge
          key={discussion.id}
          discussion={discussion}
          viewer={"potentialBeneficiary"}
          isEstablishmentReachableByPhoneAfter15Days={
            discussion.isEstablishmentReachableByPhoneAfter15Days
          }
          small
        />,
        <Button
          key={discussion.id}
          id={`${domElementIds.beneficiaryDashboard.manageDiscussions.goToDiscussionButton}--${discussion.id}`}
          size="small"
          priority="secondary"
          linkProps={{
            ...frontRoutes.beneficiaryDashboardDiscussions({
              discussionId: discussion.id,
            }).link,
          }}
        >
          Voir la candidature
        </Button>,
      ])}
      pagination={{
        count: pagination.totalPages,
        defaultPage: pagination.currentPage,
        showFirstLast: true,
        getPageLinkProps: (pageNumber) => ({
          title: `Résultats de recherche, page : ${pageNumber}`,
          onClick: (event) => {
            event.preventDefault();
            dispatch(
              discussionSlice.actions.fetchDiscussionListRequested({
                jwt: connectedUserJwt,
                filters: { ...filters, page: pageNumber },
                feedbackTopic: "establishment-dashboard-discussion-list",
              }),
            );
          },
          href: "#",
          key: `pagination-link-${pageNumber}`,
        }),
      }}
    />
  );
};
