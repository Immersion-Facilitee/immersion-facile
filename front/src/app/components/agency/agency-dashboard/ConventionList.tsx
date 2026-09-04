import { fr } from "@codegouvfr/react-dsfr";
import Button from "@codegouvfr/react-dsfr/Button";
import { Checkbox, type CheckboxProps } from "@codegouvfr/react-dsfr/Checkbox";
import { Input } from "@codegouvfr/react-dsfr/Input";
import RadioButtons, {
  type RadioButtonsProps,
} from "@codegouvfr/react-dsfr/RadioButtons";
import Tooltip from "@codegouvfr/react-dsfr/Tooltip";
import { equals, pick } from "ramda";
import { Fragment, useEffect, useMemo, useState } from "react";
import { HeadingSection, RichTable } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type ConventionId,
  type ConventionStatus,
  conventionStatuses,
  type DateString,
  defaultPerPageInWebPagination,
  domElementIds,
  type FlatGetConventionsForAgencyUserParams,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  isConventionArchived,
  isNotEmptyArray,
} from "shared";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { MetabaseFullScreenButton } from "src/app/components/MetabaseFullScreenButton";
import { labelAndSeverityByStatus } from "src/app/contents/convention/labelAndSeverityByStatus";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { getAssessmentLabelsAndSeverityByStatus } from "src/app/utils/assessment.utils";
import logoFtSvg from "src/assets/img/logo-ft.svg";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { connectedUserSelectors } from "src/core-logic/domain/connected-user/connectedUser.selectors";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import {
  conventionListSlice,
  initialConventionWithPagination,
} from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import { match, P } from "ts-pattern";
import { useStyles } from "tss-react/dsfr";
import { ConventionAssessmentStatusBadge } from "../../convention/ConventionAssessmentStatusBadge";
import { ConventionDatesDisplay } from "../../convention/ConventionDatesDisplay";
import { ConventionStatusBadge } from "../../convention/ConventionStatusBadge";

type DateFilterType = keyof Pick<
  FlatGetConventionsForAgencyUserParams,
  "dateStartFrom" | "dateStartTo" | "dateEndFrom" | "dateEndTo"
>;

type DateFilterState = {
  type: DateFilterType;
  value: string;
};

type DateFilterStates = {
  dateStart: DateFilterState;
  dateEnd: DateFilterState;
};

export const ConventionList = () => {
  const dispatch = useDispatch();
  const { cx } = useStyles();
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

  const [dateFilterStates, setDateFilterStates] = useState<DateFilterStates>({
    dateStart: {
      type: "dateStartFrom",
      value: "",
    },
    dateEnd: {
      type: "dateEndFrom",
      value: "",
    },
  });

  const assessmentOptions: RadioButtonsProps["options"] = useMemo(
    () => [
      {
        label: getAssessmentLabelsAndSeverityByStatus({ isPlural: true })[
          "to-complete"
        ].longLabel,
        nativeInputProps: {
          value: "to-complete",
          checked:
            tempFilters.assessmentCompletionStatus?.includes("to-complete"),
          onChange: () => {
            setTempFilters((prev) => ({
              ...prev,
              assessmentCompletionStatus: ["to-complete"],
            }));
          },
        },
      },
      {
        label: getAssessmentLabelsAndSeverityByStatus({ isPlural: true })[
          "to-sign"
        ].longLabel,
        nativeInputProps: {
          value: "to-sign",
          checked: tempFilters.assessmentCompletionStatus?.includes("to-sign"),
          onChange: () => {
            setTempFilters((prev) => ({
              ...prev,
              assessmentCompletionStatus: ["to-sign"],
            }));
          },
        },
      },
      {
        label: getAssessmentLabelsAndSeverityByStatus({ isPlural: true })
          .finalized.longLabel,
        hintText: getAssessmentLabelsAndSeverityByStatus({ isPlural: true })
          .finalized.description,
        nativeInputProps: {
          value: "finalized",
          checked:
            tempFilters.assessmentCompletionStatus?.includes("finalized"),
          onChange: () => {
            setTempFilters((prev) => ({
              ...prev,
              assessmentCompletionStatus: ["finalized"],
            }));
          },
        },
      },
    ],
    [tempFilters.assessmentCompletionStatus],
  );

  const statusOptions: CheckboxProps["options"] = useMemo(() => {
    return conventionStatuses.map((status) => ({
      label: labelAndSeverityByStatus[status].label.agency,
      nativeInputProps: {
        value: status,
        checked: tempFilters.statuses?.includes(status) ?? false,
        onChange: (event) => {
          const existingStatuses = tempFilters.statuses ?? [];
          const newStatuses =
            event.currentTarget.checked &&
            isStringConventionStatus(event.currentTarget.value)
              ? [...existingStatuses, event.currentTarget.value]
              : existingStatuses.filter(
                  (status) => status !== event.currentTarget.value,
                );

          setTempFilters({
            ...tempFilters,
            statuses: isNotEmptyArray(newStatuses) ? newStatuses : undefined,
          });
        },
      },
    }));
  }, [tempFilters]);

  const agencyOptions: CheckboxProps["options"] = useMemo(() => {
    if (!hasManyAgencies || !currentUser?.agencyRights) return [];

    return currentUser.agencyRights
      .filter(
        (agencyRight) =>
          agencyRight.agency.status !== "needsReview" &&
          agencyRight.agency.status !== "rejected",
      )
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

  const startDateOptions: RadioButtonsProps["options"] = useMemo(
    () =>
      createDateOptions(
        "dateStart",
        dateFilterStates.dateStart,
        tempFilters,
        setDateFilterStates,
      ),
    [dateFilterStates.dateStart, tempFilters],
  );

  const endDateOptions: RadioButtonsProps["options"] = useMemo(
    () =>
      createDateOptions(
        "dateEnd",
        dateFilterStates.dateEnd,
        tempFilters,
        setDateFilterStates,
      ),
    [dateFilterStates.dateEnd, tempFilters],
  );

  const onSubmit = (filtersToUse = tempFilters, searchQuery?: string) => {
    if (!connectedUserJwt) return;

    dispatch(
      conventionListSlice.actions.fetchConventionListRequested({
        jwt: connectedUserJwt,
        filters: {
          ...filters,
          ...filtersToUse,
          ...(searchQuery && { search: searchQuery }),
          page: 1,
          perPage: defaultPerPageInWebPagination,
        },
        feedbackTopic: "connected-user-convention-list",
      }),
    );
  };

  useEffect(() => {
    if (connectedUserJwt) {
      dispatch(
        conventionListSlice.actions.fetchConventionListRequested({
          filters: {
            sortBy: "dateStart",
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

  const getTableHeaders = () => {
    if (hasConventions) {
      return [
        "Conseiller",
        "Statut",
        "Bilan",
        "Personne en immersion",
        "Établissement",
        "Dates",
        "Actions",
      ];
    }
    if (!filtersAreEmpty) {
      return [
        "Aucune convention trouvée avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche.",
      ];
    }
    return ["Nous n'avons pas trouvé de convention."];
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
              data={conventions.map((convention) => [
                <Fragment key={`${convention.id}-counsellor`}>
                  <strong>
                    {getFormattedFirstnameAndLastname({
                      firstname: convention.agencyReferent?.firstname,
                      lastname: convention.agencyReferent?.lastname,
                    }) || "Non communiqué"}
                  </strong>{" "}
                  <Tooltip kind="hover" title={convention.agencyName} />
                </Fragment>,
                <Fragment key={`${convention.id}-status`}>
                  <ConventionStatusBadge
                    conventionStatus={convention.status}
                    userKind="agency"
                  />
                </Fragment>,
                <Fragment key={`${convention.id}-assessment`}>
                  <ConventionAssessmentStatusBadge
                    conventionParams={convention}
                    userKind="agency"
                  />
                </Fragment>,

                <Fragment key={`${convention.id}-beneficiary`}>
                  <strong>
                    {getFormattedFirstnameAndLastname({
                      firstname: convention.beneficiary.firstName,
                      lastname: convention.beneficiary.lastName,
                    })}
                  </strong>
                  {convention.beneficiary.federatedIdentity?.provider ===
                    "ftConnect" && (
                    <div className={fr.cx("fr-mt-1w")}>
                      <img
                        src={logoFtSvg}
                        alt=""
                        aria-hidden="true"
                        className={fr.cx("fr-icon--sm", "fr-mr-1w")}
                      />
                      <strong
                        className={fr.cx("fr-text--sm", "fr-label--info")}
                      >
                        FT Connect
                      </strong>
                    </div>
                  )}
                </Fragment>,
                <Fragment key={`${convention.id}-establishment`}>
                  <strong>{convention.businessName}</strong>
                </Fragment>,
                <Fragment key={`${convention.id}-dates`}>
                  <ConventionDatesDisplay
                    dateStart={convention.dateStart}
                    dateEnd={convention.dateEnd}
                  />
                </Fragment>,

                <ConventionActionButton
                  key={`${convention.id}-actions`}
                  conventionId={convention.id}
                  conventionDateEnd={convention.dateEnd}
                />,
              ])}
              dropdownFilters={{
                items: [
                  {
                    id: "status",
                    iconId: "fr-icon-equalizer-line",
                    defaultValue: "Tous les statuts",
                    values:
                      filters.statuses?.length &&
                      filters.statuses?.length !== conventionStatuses.length
                        ? [
                            `${filters.statuses.length > 1 ? "Statuts" : "Statut :"}  ${
                              filters.statuses.length > 1
                                ? `(${filters.statuses.length})`
                                : filters.statuses
                                    .map(
                                      (status) =>
                                        labelAndSeverityByStatus[status].label
                                          .agency,
                                    )
                                    .join(", ")
                            }`,
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
                      (() => {
                        if (
                          tempFilters.assessmentCompletionStatus?.includes(
                            "finalized",
                          )
                        ) {
                          return `Bilan : ${getAssessmentLabelsAndSeverityByStatus({ isPlural: true }).finalized.longLabel}`;
                        }
                        if (
                          tempFilters.assessmentCompletionStatus?.includes(
                            "to-sign",
                          )
                        ) {
                          return `Bilan : ${getAssessmentLabelsAndSeverityByStatus({ isPlural: true })["to-sign"].longLabel}`;
                        }
                        if (
                          tempFilters.assessmentCompletionStatus?.includes(
                            "to-complete",
                          )
                        ) {
                          return `Bilan : ${getAssessmentLabelsAndSeverityByStatus({ isPlural: true })["to-complete"].longLabel}`;
                        }
                        return "Tous les bilans";
                      })(),
                    ],
                    submenu: {
                      title: "Filtrer par statut du bilan",
                      content: (
                        <>
                          <RadioButtons options={assessmentOptions} />
                        </>
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
                    defaultValue: "Date de début",
                    values: [
                      (() => {
                        if (filters.dateStartFrom) {
                          return `Démarrant après le ${filters.dateStartFrom}`;
                        }
                        if (filters.dateStartTo) {
                          return `Démarrant avant le ${filters.dateStartTo}`;
                        }
                        return "Date de début";
                      })(),
                    ],
                    submenu: {
                      title: "Filtrer par date de début",
                      content: (
                        <>
                          <RadioButtons options={startDateOptions} />
                          <div className={cx("fr-mb-2w")}>
                            <Input
                              label="Date"
                              nativeInputProps={{
                                type: "date",
                                value: dateFilterStates.dateStart.value,
                                onChange: (event) => {
                                  setDateFilterStates((prev) => ({
                                    ...prev,
                                    dateStart: {
                                      ...prev.dateStart,
                                      value: event.target.value,
                                    },
                                  }));
                                  const newFilters = {
                                    ...tempFilters,
                                    [dateFilterStates.dateStart.type]:
                                      event.target.value || undefined,
                                    ...(dateFilterStates.dateStart.type ===
                                    "dateStartFrom"
                                      ? { dateStartTo: undefined }
                                      : { dateStartFrom: undefined }),
                                  };
                                  setTempFilters(newFilters);
                                },
                              }}
                            />
                          </div>
                        </>
                      ),
                    },
                    onReset: () => {
                      setDateFilterStates((prev) => ({
                        ...prev,
                        dateStart: {
                          type: "dateStartFrom",
                          value: "",
                        },
                      }));
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
                    defaultValue: "Date de fin",
                    values: [
                      (() => {
                        if (filters.dateEndFrom) {
                          return `Se terminant après le ${filters.dateEndFrom}`;
                        }
                        if (filters.dateEndTo) {
                          return `Se terminant avant le ${filters.dateEndTo}`;
                        }
                        return "Date de fin";
                      })(),
                    ],
                    submenu: {
                      title: "Filtrer par date de fin",
                      content: (
                        <>
                          <RadioButtons options={endDateOptions} />
                          <div className={cx("fr-mb-2w")}>
                            <Input
                              label="Date"
                              nativeInputProps={{
                                type: "date",
                                value: dateFilterStates.dateEnd.value,
                                onChange: (event) => {
                                  setDateFilterStates((prev) => ({
                                    ...prev,
                                    dateEnd: {
                                      ...prev.dateEnd,
                                      value: event.target.value,
                                    },
                                  }));
                                  const newFilters = {
                                    ...tempFilters,
                                    [dateFilterStates.dateEnd.type]:
                                      event.target.value || undefined,
                                    ...(dateFilterStates.dateEnd.type ===
                                    "dateEndFrom"
                                      ? { dateEndTo: undefined }
                                      : { dateEndFrom: undefined }),
                                  };
                                  setTempFilters(newFilters);
                                },
                              }}
                            />
                          </div>
                        </>
                      ),
                    },
                    onReset: () => {
                      setDateFilterStates((prev) => ({
                        ...prev,
                        dateEnd: {
                          type: "dateEndFrom",
                          value: "",
                        },
                      }));
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
                  onSubmit(tempFilters, query);
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

const ConventionActionButton = ({
  conventionId,
  conventionDateEnd,
}: {
  conventionId: ConventionId;
  conventionDateEnd: DateString;
}): React.ReactNode =>
  isConventionArchived({ dateEnd: conventionDateEnd, now: new Date() }) ? (
    <Button
      id={`${domElementIds.agencyDashboard.dashboard.unarchiveConventionButton}--${conventionId}`}
      size="small"
      priority="secondary"
      linkProps={{
        ...frontRoutes.archivedConventionRequest({ conventionId }).link,
        target: "_blank",
      }}
    >
      Désarchiver
    </Button>
  ) : (
    <Button
      id={`${domElementIds.agencyDashboard.dashboard.goToConventionButton}--${conventionId}`}
      size="small"
      priority="secondary"
      linkProps={{
        ...frontRoutes.manageConventionConnectedUser({
          conventionId,
        }).link,
        target: "_blank",
      }}
    >
      Piloter
    </Button>
  );

const isStringConventionStatus = (value: string): value is ConventionStatus => {
  return conventionStatuses.includes(value as ConventionStatus);
};

const createDateOptions = (
  filterType: "dateStart" | "dateEnd",
  currentState: DateFilterState,
  tempFilters: Pick<
    FlatGetConventionsForAgencyUserParams,
    "dateStartFrom" | "dateStartTo" | "dateEndFrom" | "dateEndTo"
  >,
  setDateFilterStates: React.Dispatch<React.SetStateAction<DateFilterStates>>,
): RadioButtonsProps["options"] => {
  const config: {
    dateStart: {
      labels: { before: string; after: string };
      types: { to: "dateStartTo"; from: "dateStartFrom" };
      values: { to: string | undefined; from: string | undefined };
    };
    dateEnd: {
      labels: { before: string; after: string };
      types: { to: "dateEndTo"; from: "dateEndFrom" };
      values: { to: string | undefined; from: string | undefined };
    };
  } = {
    dateStart: {
      labels: { before: "Démarrant avant le", after: "Démarrant après le" },
      types: { to: "dateStartTo", from: "dateStartFrom" },
      values: { to: tempFilters.dateStartTo, from: tempFilters.dateStartFrom },
    },
    dateEnd: {
      labels: {
        before: "Se terminant avant le",
        after: "Se terminant après le",
      },
      types: { to: "dateEndTo", from: "dateEndFrom" },
      values: { to: tempFilters.dateEndTo, from: tempFilters.dateEndFrom },
    },
  };

  const { labels, types, values } = config[filterType];

  return [
    {
      label: labels.before,
      nativeInputProps: {
        value: types.to,
        defaultChecked: currentState.type === types.to,
        onChange: () => {
          setDateFilterStates((prev) => ({
            ...prev,
            [filterType]: {
              type: types.to,
              value: values.to || "",
            },
          }));
        },
      },
    },
    {
      label: labels.after,
      nativeInputProps: {
        value: types.from,
        defaultChecked: currentState.type === types.from,
        onChange: () => {
          setDateFilterStates((prev) => ({
            ...prev,
            [filterType]: {
              type: types.from,
              value: values.from || "",
            },
          }));
        },
      },
    },
  ];
};
