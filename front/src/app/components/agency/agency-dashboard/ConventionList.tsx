import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { Checkbox, type CheckboxProps } from "@codegouvfr/react-dsfr/Checkbox";
import { equals, pick } from "ramda";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  HeadingSection,
  RichTable,
  type RichTableProps,
} from "react-design-system";
import { useDispatch } from "react-redux";
import {
  defaultPerPageInWebPagination,
  domElementIds,
  type FlatGetConventionsForAgencyUserParams,
  isConventionArchived,
  isNotEmptyArray,
} from "shared";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { MetabaseFullScreenButton } from "src/app/components/MetabaseFullScreenButton";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import {
  conventionListSlice,
  initialConventionWithPagination,
} from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import { match, P } from "ts-pattern";
import { ConventionAssessmentStatusBadge } from "../../convention/ConventionAssessmentStatusBadge";
import { ConventionDatesDisplay } from "../../convention/ConventionDatesDisplay";
import { ConventionStatusBadge } from "../../convention/ConventionStatusBadge";
import {
  AgencyReferentCell,
  BeneficiaryCell,
} from "../../convention/convention-list/ConventionListCells";
import {
  BeforeOrAfterDateFilter,
  type BeforeOrAfterDateFilterLabels,
  makeAssessmentCompletionStatusOptions,
  makeConventionStatusOptions,
  toAppliedAssessmentCompletionStatusLabel,
  toAppliedBeforeOrAfterDateLabel,
  toAppliedConventionStatusesLabel,
} from "../../convention/convention-list/conventionListFilters";
import { UnarchivedOrManageConventionButton } from "../../convention/UnarchivedOrManageConventionButton";

const dateStartFilterLabels: BeforeOrAfterDateFilterLabels = {
  defaultLabel: "Date de début",
  before: "Démarrant avant le",
  after: "Démarrant après le",
};

const dateEndFilterLabels: BeforeOrAfterDateFilterLabels = {
  defaultLabel: "Date de fin",
  before: "Se terminant avant le",
  after: "Se terminant après le",
};

export const ConventionList = () => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const currentUser = useAppSelector(connectedUserSelectors.currentUser);
  const {
    data: conventions,
    pagination,
    filters,
  } = useAppSelector(conventionListSelectors.conventionsWithPagination);
  const hasConventions = conventions.length > 0;
  const hasManyAgencies = (currentUser?.agencyRights?.length ?? 0) > 1;
  const filtersAreEmpty = equals(
    filters,
    initialConventionWithPagination.filters,
  );
  const isLoading = useAppSelector(conventionListSelectors.isLoading);

  const defaultFilters = useMemo(
    () =>
      pick(
        [
          "statuses",
          "dateStartFrom",
          "dateStartTo",
          "dateEndFrom",
          "dateEndTo",
          "assessmentCompletionStatus",
          "agencyIds",
        ],
        initialConventionWithPagination.filters,
      ),
    [],
  );

  const [tempFilters, setTempFilters] =
    useState<
      Pick<
        FlatGetConventionsForAgencyUserParams,
        | "statuses"
        | "dateStartFrom"
        | "dateStartTo"
        | "dateEndFrom"
        | "dateEndTo"
        | "assessmentCompletionStatus"
        | "agencyIds"
      >
    >(defaultFilters);

  const agencyOptions: CheckboxProps["options"] = useMemo(() => {
    if (!hasManyAgencies || !currentUser?.agencyRights) return [];

    return currentUser.agencyRights
      .filter(
        (agencyRight) =>
          agencyRight.agency.status !== "needsReview" &&
          agencyRight.agency.status !== "rejected",
      )
      .sort((a, b) => a.agency.name.localeCompare(b.agency.name))
      .map((agencyRight) => ({
        label: agencyRight.agency.name,
        nativeInputProps: {
          value: agencyRight.agency.id,
          checked:
            tempFilters.agencyIds?.includes(agencyRight.agency.id) ?? false,
          onChange: (event) => {
            const existingAgencyIds = tempFilters.agencyIds ?? [];
            const newAgencyIds = event.currentTarget.checked
              ? [...existingAgencyIds, event.currentTarget.value]
              : existingAgencyIds.filter(
                  (id) => id !== event.currentTarget.value,
                );

            setTempFilters({
              ...tempFilters,
              agencyIds: isNotEmptyArray(newAgencyIds)
                ? newAgencyIds
                : undefined,
            });
          },
        },
      }));
  }, [hasManyAgencies, currentUser?.agencyRights, tempFilters]);

  const fetchConventions = (
    filtersToUse: typeof tempFilters,
    search: string | undefined,
  ) => {
    if (!connectedUserJwt) return;

    dispatch(
      conventionListSlice.actions.fetchConventionListRequested({
        jwt: connectedUserJwt,
        filters: {
          ...filters,
          ...filtersToUse,
          search,
          page: 1,
          perPage: defaultPerPageInWebPagination,
        },
        feedbackTopic: "connected-user-convention-list",
      }),
    );
  };

  const onSubmit = (filtersToUse = tempFilters) =>
    fetchConventions(filtersToUse, filters.search);

  useEffect(() => {
    if (connectedUserJwt) {
      dispatch(
        conventionListSlice.actions.fetchConventionListRequested({
          filters: {
            sortBy: "dateSubmission",
            sortDirection: "desc",
            page: 1,
            perPage: 10,
          },
          jwt: connectedUserJwt,
          feedbackTopic: "connected-user-conventions",
        }),
      );
    }

    return () => {
      dispatch(conventionListSlice.actions.clearConventionListFilters());
    };
  }, [dispatch, connectedUserJwt]);

  if (!connectedUserJwt) {
    return;
  }

  const getTableHeaders = (): RichTableProps["headers"] => {
    if (hasConventions) {
      return [
        { content: "Conseiller" },
        { content: "Statut" },
        { content: "Bilan" },
        { content: "Personne en immersion" },
        { content: "Établissement" },
        { content: "Dates" },
        { content: "Actions" },
      ];
    }
    if (!filtersAreEmpty) {
      return [
        {
          content:
            "Aucune convention trouvée avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche.",
        },
      ];
    }
    return [{ content: "Nous n'avons pas trouvé de convention." }];
  };

  return (
    <HeadingSection
      title="Conventions"
      titleAs="h3"
      className={fr.cx("fr-mt-4w")}
      titleAction={
        currentUser?.dashboards.agencies.agencyDashboardUrl ? (
          <MetabaseFullScreenButton
            url={currentUser.dashboards.agencies.agencyDashboardUrl}
            label="Télécharger les données (Excel/CSV)"
            tooltipText="L’export se fait depuis l’ancien tableau Metabase."
          />
        ) : null
      }
    >
      <WithFeedbackReplacer topic="connected-user-convention-list">
        {match({
          conventions,
        })

          .with({ conventions: P.nullish }, () => (
            <p>Nous n'avons pas trouvé de conventions</p>
          ))
          .with({ conventions: P.not(P.nullish) }, () => (
            <RichTable
              headers={getTableHeaders()}
              isLoading={isLoading}
              label={"Listing des conventions"}
              hasViewSwitch={false}
              tableData={conventions.map((convention) => [
                <AgencyReferentCell
                  key={`${convention.id}-counsellor`}
                  agencyReferent={convention.agencyReferent}
                  agencyName={convention.agencyName}
                />,
                <Fragment key={`${convention.id}-status`}>
                  <ul
                    className={fr.cx("fr-badges-group", "fr-badges-group--sm")}
                  >
                    <li>
                      <ConventionStatusBadge
                        conventionStatus={convention.status}
                        userKind="agency"
                      />
                    </li>
                    {isConventionArchived({
                      dateEnd: convention.dateEnd,
                      now: new Date(),
                    }) && (
                      <li>
                        <Badge small>Archivée</Badge>
                      </li>
                    )}
                  </ul>
                </Fragment>,
                <Fragment key={`${convention.id}-assessment`}>
                  <ConventionAssessmentStatusBadge
                    conventionParams={convention}
                    userKind="agency"
                  />
                </Fragment>,

                <BeneficiaryCell
                  key={`${convention.id}-beneficiary`}
                  beneficiary={convention.beneficiary}
                />,
                <Fragment key={`${convention.id}-establishment`}>
                  <strong>{convention.businessName}</strong>
                </Fragment>,
                <Fragment key={`${convention.id}-dates`}>
                  <ConventionDatesDisplay
                    dateStart={convention.dateStart}
                    dateEnd={convention.dateEnd}
                  />
                </Fragment>,

                <UnarchivedOrManageConventionButton
                  label="Piloter"
                  key={`${convention.id}-actions`}
                  conventionId={convention.id}
                  conventionDateEnd={convention.dateEnd}
                  isDisabled={false}
                  id={`${domElementIds.agencyDashboard.dashboard.goToConventionButton}--${convention.id}`}
                />,
              ])}
              dropdownFilters={{
                items: [
                  {
                    id: "status",
                    iconId: "fr-icon-equalizer-line",
                    defaultValue: "Tous les statuts",
                    values: [
                      toAppliedConventionStatusesLabel(filters.statuses),
                    ],
                    submenu: {
                      title: "Filtrer par statut",
                      content: (
                        <Checkbox
                          options={makeConventionStatusOptions({
                            selectedValues: tempFilters.statuses,
                            onChange: (statuses) =>
                              setTempFilters({ ...tempFilters, statuses }),
                          })}
                        />
                      ),
                    },
                    onReset: () => {
                      const newFilters = {
                        ...tempFilters,
                        statuses: undefined,
                      };
                      setTempFilters(newFilters);
                      onSubmit(newFilters);
                    },
                  },
                  {
                    id: "assessment",
                    iconId: "fr-icon-checkbox-line",
                    defaultValue: "Tous les bilans",
                    values: [
                      toAppliedAssessmentCompletionStatusLabel(
                        filters.assessmentCompletionStatus,
                      ),
                    ],
                    submenu: {
                      title: "Filtrer par statut du bilan",
                      content: (
                        <Checkbox
                          options={makeAssessmentCompletionStatusOptions({
                            selectedValues:
                              tempFilters.assessmentCompletionStatus,
                            onChange: (assessmentCompletionStatus) =>
                              setTempFilters({
                                ...tempFilters,
                                assessmentCompletionStatus,
                              }),
                          })}
                        />
                      ),
                    },
                    onReset: () => {
                      const newFilters = {
                        ...tempFilters,
                        assessmentCompletionStatus: undefined,
                      };
                      setTempFilters(newFilters);
                      onSubmit(newFilters);
                    },
                  },
                  {
                    id: "dateStart",
                    iconId: "fr-icon-calendar-line",
                    defaultValue: dateStartFilterLabels.defaultLabel,
                    values: [
                      toAppliedBeforeOrAfterDateLabel(dateStartFilterLabels, {
                        from: filters.dateStartFrom,
                        to: filters.dateStartTo,
                      }),
                    ],
                    submenu: {
                      title: "Filtrer par date de début",
                      content: (
                        <BeforeOrAfterDateFilter
                          labels={dateStartFilterLabels}
                          value={{
                            from: tempFilters.dateStartFrom,
                            to: tempFilters.dateStartTo,
                          }}
                          onChange={({ from, to }) =>
                            setTempFilters({
                              ...tempFilters,
                              dateStartFrom: from,
                              dateStartTo: to,
                            })
                          }
                        />
                      ),
                    },
                    onReset: () => {
                      const newFilters = {
                        ...tempFilters,
                        dateStartFrom: undefined,
                        dateStartTo: undefined,
                      };
                      setTempFilters(newFilters);
                      onSubmit(newFilters);
                    },
                  },
                  {
                    id: "dateEnd",
                    iconId: "fr-icon-calendar-line",
                    defaultValue: dateEndFilterLabels.defaultLabel,
                    values: [
                      toAppliedBeforeOrAfterDateLabel(dateEndFilterLabels, {
                        from: filters.dateEndFrom,
                        to: filters.dateEndTo,
                      }),
                    ],
                    submenu: {
                      title: "Filtrer par date de fin",
                      content: (
                        <BeforeOrAfterDateFilter
                          labels={dateEndFilterLabels}
                          value={{
                            from: tempFilters.dateEndFrom,
                            to: tempFilters.dateEndTo,
                          }}
                          onChange={({ from, to }) =>
                            setTempFilters({
                              ...tempFilters,
                              dateEndFrom: from,
                              dateEndTo: to,
                            })
                          }
                        />
                      ),
                    },
                    onReset: () => {
                      const newFilters = {
                        ...tempFilters,
                        dateEndFrom: undefined,
                        dateEndTo: undefined,
                      };
                      setTempFilters(newFilters);
                      onSubmit(newFilters);
                    },
                  },
                  ...(hasManyAgencies
                    ? [
                        {
                          id: "agencies",
                          iconId: "fr-icon-checkbox-line" as const,
                          defaultValue: "Toutes les agences",
                          values: [
                            (() => {
                              if (filters.agencyIds?.length) {
                                const selectedAgencies =
                                  currentUser?.agencyRights
                                    ?.filter((agencyRight) =>
                                      filters.agencyIds?.includes(
                                        agencyRight.agency.id,
                                      ),
                                    )
                                    .map(
                                      (agencyRight) => agencyRight.agency.name,
                                    );

                                if (selectedAgencies?.length === 1) {
                                  return selectedAgencies[0];
                                }
                                if (
                                  selectedAgencies &&
                                  selectedAgencies.length > 1
                                ) {
                                  return `Agences (${selectedAgencies.length})`;
                                }
                              }
                              return "Toutes les agences";
                            })(),
                          ],
                          submenu: {
                            title: "Filtrer par agence",
                            content: (
                              <>
                                <Checkbox options={agencyOptions} />
                              </>
                            ),
                          },
                          onReset: () => {
                            const newFilters = {
                              ...tempFilters,
                              agencyIds: undefined,
                            };
                            setTempFilters(newFilters);
                            onSubmit(newFilters);
                          },
                        },
                      ]
                    : []),
                ],
                onSubmit: () => onSubmit(),
              }}
              searchBar={{
                label: "Rechercher",
                hintText:
                  "Astuce : saisir un nom de conseiller dans la recherche permet d’afficher uniquement ses conventions.",
                placeholder:
                  "Rechercher une convention (ID, nom, prénom, conseiller, email, SIRET, etc.)",
                onSubmit: (query: string) => {
                  fetchConventions(tempFilters, query.trim() || undefined);
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
                      conventionListSlice.actions.fetchConventionListRequested({
                        jwt: connectedUserJwt,
                        filters: { ...filters, page: pageNumber },
                        feedbackTopic:
                          "establishment-dashboard-discussion-list",
                      }),
                    );
                  },
                  href: "#",
                  key: `pagination-link-${pageNumber}`,
                }),
              }}
            />
          ))
          .exhaustive()}
      </WithFeedbackReplacer>
    </HeadingSection>
  );
};
