import { type FrIconClassName, fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import { Checkbox, type CheckboxProps } from "@codegouvfr/react-dsfr/Checkbox";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Fragment, useEffect, useState } from "react";
import { type RichDropdownProps, RichTable } from "react-design-system";
import { useDispatch } from "react-redux";
import {
  type AdminConventionListDto,
  type AgencyKind,
  adminConventionListMaxResults,
  adminConventionListTextFilterMinLength,
  agencyKindToLabelIncludingIFAndPrepa,
  type ConventionStatus,
  conventionStatuses,
  defaultPerPageInWebPagination,
  domElementIds,
  type FlatGetConventionsForAdminParams,
  flatGetConventionsForAdminParamsSchema,
  frontRoutes,
  getFormattedFirstnameAndLastname,
  isNotEmptyArray,
  toDisplayedDate,
} from "shared";
import { ConventionDatesDisplay } from "src/app/components/convention/ConventionDatesDisplay";
import { ConventionStatusBadge } from "src/app/components/convention/ConventionStatusBadge";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { MetabaseFullScreenButton } from "src/app/components/MetabaseFullScreenButton";
import { labelAndSeverityByStatus } from "src/app/contents/convention/labelAndSeverityByStatus";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useAdminDashboard } from "src/app/pages/admin/useAdminDashboard";
import logoFtSvg from "src/assets/img/logo-ft.svg";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import {
  conventionListSlice,
  initialAdminConventionList,
} from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";
import { feedbackSlice } from "src/core-logic/domain/feedback/feedback.slice";
import Styles from "./AdminConventionListSection.styles";

type TextFilterName = keyof Pick<
  FlatGetConventionsForAdminParams,
  "agencyNameContains"
>;

type DateFilterName = keyof Pick<
  FlatGetConventionsForAdminParams,
  "dateStartFrom" | "dateStartTo" | "dateValidationFrom" | "dateValidationTo"
>;

type FilterName = TextFilterName | DateFilterName;

type FilterFormValues = Record<FilterName, string> & {
  statuses: ConventionStatus[];
  search: string;
};

type FilterField = {
  name: FilterName;
  label: string;
  type: "text" | "date";
  hintText?: string;
};

type FilterGroup = {
  id: "agency" | "dateStart" | "dateValidation";
  iconId: FrIconClassName;
  defaultValue: string;
  submenuTitle: string;
  fields: FilterField[];
  toAppliedFilterLabel: (
    filters: FlatGetConventionsForAdminParams,
  ) => string | undefined;
};

const feedbackTopic: FeedbackTopic = "admin-convention-list";

const textContainsHintText = `${adminConventionListTextFilterMinLength} caractères minimum`;

const filterFields = {
  agencyNameContains: {
    name: "agencyNameContains",
    label: "Agence",
    type: "text",
    hintText: textContainsHintText,
  },
  dateStartFrom: { name: "dateStartFrom", label: "À partir du", type: "date" },
  dateStartTo: { name: "dateStartTo", label: "Jusqu'au", type: "date" },
  dateValidationFrom: {
    name: "dateValidationFrom",
    label: "À partir du",
    type: "date",
  },
  dateValidationTo: {
    name: "dateValidationTo",
    label: "Jusqu'au",
    type: "date",
  },
} satisfies Record<FilterName, FilterField>;

const toAppliedAgencyNameLabel = ({
  agencyNameContains,
}: FlatGetConventionsForAdminParams): string | undefined =>
  agencyNameContains
    ? `${filterFields.agencyNameContains.label} : ${agencyNameContains}`
    : undefined;

const toAppliedDateRangeLabel =
  (groupLabel: string, fromName: DateFilterName, toName: DateFilterName) =>
  (filters: FlatGetConventionsForAdminParams): string | undefined => {
    const from = filters[fromName];
    const to = filters[toName];
    if (from && to)
      return `${groupLabel} : du ${toDisplayedDate({ date: new Date(from) })} au ${toDisplayedDate({ date: new Date(to) })}`;
    if (from)
      return `${groupLabel} : à partir du ${toDisplayedDate({ date: new Date(from) })}`;
    if (to)
      return `${groupLabel} : jusqu'au ${toDisplayedDate({ date: new Date(to) })}`;
  };

const filterGroups: FilterGroup[] = [
  {
    id: "agency",
    iconId: "fr-icon-building-line",
    defaultValue: "Toutes les agences",
    submenuTitle: "Filtrer par agence",
    fields: [filterFields.agencyNameContains],
    toAppliedFilterLabel: toAppliedAgencyNameLabel,
  },
  {
    id: "dateStart",
    iconId: "fr-icon-calendar-line",
    defaultValue: "Date de début",
    submenuTitle: "Filtrer par date de début de l'immersion",
    fields: [filterFields.dateStartFrom, filterFields.dateStartTo],
    toAppliedFilterLabel: toAppliedDateRangeLabel(
      "Début",
      "dateStartFrom",
      "dateStartTo",
    ),
  },
  {
    id: "dateValidation",
    iconId: "fr-icon-calendar-line",
    defaultValue: "Date de validation",
    submenuTitle: "Filtrer par date de validation",
    fields: [filterFields.dateValidationFrom, filterFields.dateValidationTo],
    toAppliedFilterLabel: toAppliedDateRangeLabel(
      "Validation",
      "dateValidationFrom",
      "dateValidationTo",
    ),
  },
];

const emptyFilterFormValues: FilterFormValues = {
  statuses: [],
  search: "",
  agencyNameContains: "",
  dateStartFrom: "",
  dateStartTo: "",
  dateValidationFrom: "",
  dateValidationTo: "",
};

const toResultCountLabel = (totalRecords: number): string => {
  if (totalRecords >= adminConventionListMaxResults)
    return `${adminConventionListMaxResults} conventions ou plus : seules les ${adminConventionListMaxResults} plus récentes sont consultables, affinez les filtres pour trouver les plus anciennes.`;
  if (totalRecords <= 1) return `${totalRecords} convention`;
  return `${totalRecords} conventions`;
};

const toAppliedStatusesLabel = (
  statuses: ConventionStatus[] | undefined,
): string | undefined => {
  if (!statuses?.length || statuses.length === conventionStatuses.length)
    return;
  if (statuses.length > 1) return `Statuts (${statuses.length})`;
  return `Statut : ${labelAndSeverityByStatus[statuses[0]].label.agency}`;
};

export const AdminConventionListSection = (): React.ReactNode => {
  const dispatch = useDispatch();
  const connectedUserJwt = useAppSelector(authSelectors.connectedUserJwt);
  const { url: metabaseDashboardUrl } = useAdminDashboard({
    name: "adminConventions",
  });
  const isLoading = useAppSelector(conventionListSelectors.isLoading);
  const {
    data: conventions,
    pagination,
    filters,
  } = useAppSelector(conventionListSelectors.adminConventionList);
  const [filterFormValues, setFilterFormValues] = useState<FilterFormValues>(
    emptyFilterFormValues,
  );
  const [hasSubmittedInvalidFilters, setHasSubmittedInvalidFilters] =
    useState(false);

  useEffect(() => {
    if (connectedUserJwt)
      dispatch(
        conventionListSlice.actions.fetchAdminConventionListRequested({
          jwt: connectedUserJwt,
          filters: initialAdminConventionList.filters,
          feedbackTopic,
        }),
      );

    return () => {
      dispatch(conventionListSlice.actions.clearAdminConventionListRequested());
    };
  }, [dispatch, connectedUserJwt]);

  if (!connectedUserJwt) return null;

  const filterFormValidation = flatGetConventionsForAdminParamsSchema.safeParse(
    toFlatGetConventionsForAdminParams(filterFormValues),
  );
  const filterErrorByName: Partial<Record<FilterName, string>> =
    filterFormValidation.success
      ? {}
      : Object.fromEntries(
          filterFormValidation.error.issues.map(({ path, message }) => [
            String(path[0]),
            message,
          ]),
        );

  const fetchConventions = (
    filtersToFetch: FlatGetConventionsForAdminParams,
  ): void => {
    dispatch(feedbackSlice.actions.clearFeedbackTopics([feedbackTopic]));
    dispatch(
      conventionListSlice.actions.fetchAdminConventionListRequested({
        jwt: connectedUserJwt,
        filters: filtersToFetch,
        feedbackTopic,
      }),
    );
  };

  const applyFilters = (filterValuesToApply: FilterFormValues): void => {
    const validation = flatGetConventionsForAdminParamsSchema.safeParse(
      toFlatGetConventionsForAdminParams(filterValuesToApply),
    );
    setHasSubmittedInvalidFilters(!validation.success);
    if (validation.success) fetchConventions(validation.data);
  };

  const searchConventions = (query: string): void => {
    const search = query.trim();
    if (search === (filters.search ?? "")) return;
    if (search && search.length < adminConventionListTextFilterMinLength)
      return;
    const searchedFilterFormValues = { ...filterFormValues, search };
    setFilterFormValues(searchedFilterFormValues);
    applyFilters(searchedFilterFormValues);
  };

  const resetFilters = (filterNames: FilterName[]): void => {
    const resetFilterFormValues: FilterFormValues = filterNames.reduce(
      (values, filterName) => ({ ...values, [filterName]: "" }),
      filterFormValues,
    );
    setFilterFormValues(resetFilterFormValues);
    applyFilters(resetFilterFormValues);
  };

  const statusOptions: CheckboxProps["options"] = conventionStatuses.map(
    (status) => ({
      label: labelAndSeverityByStatus[status].label.agency,
      nativeInputProps: {
        id: `${domElementIds.adminConventions.conventionListStatusCheckbox}--${status}`,
        value: status,
        checked: filterFormValues.statuses.includes(status),
        onChange: (event) =>
          setFilterFormValues({
            ...filterFormValues,
            statuses: event.currentTarget.checked
              ? [...filterFormValues.statuses, status]
              : filterFormValues.statuses.filter(
                  (selectedStatus) => selectedStatus !== status,
                ),
          }),
      },
    }),
  );

  const statusDropdownFilter: RichDropdownProps = {
    id: `${domElementIds.adminConventions.conventionListFilterDropdown}--status`,
    iconId: "fr-icon-equalizer-line",
    defaultValue: "Tous les statuts",
    values: toValues(toAppliedStatusesLabel(filters.statuses)),
    submenu: {
      title: "Filtrer par statut",
      content: <Checkbox small options={statusOptions} />,
    },
    onReset: () => {
      const resetFilterFormValues = { ...filterFormValues, statuses: [] };
      setFilterFormValues(resetFilterFormValues);
      applyFilters(resetFilterFormValues);
    },
  };

  const groupDropdownFilters: RichDropdownProps[] = filterGroups.map(
    ({
      id,
      iconId,
      defaultValue,
      submenuTitle,
      fields,
      toAppliedFilterLabel,
    }) => ({
      id: `${domElementIds.adminConventions.conventionListFilterDropdown}--${id}`,
      iconId,
      defaultValue,
      values: toValues(toAppliedFilterLabel(filters)),
      submenu: {
        title: submenuTitle,
        content: fields.map(({ name, label, type, hintText }) => {
          const error = hasSubmittedInvalidFilters
            ? filterErrorByName[name]
            : undefined;
          return (
            <Input
              key={name}
              label={label}
              hintText={hintText}
              state={error ? "error" : "default"}
              stateRelatedMessage={error}
              nativeInputProps={{
                id: `${domElementIds.adminConventions.conventionListFilterInput}--${name}`,
                name,
                type,
                value: filterFormValues[name],
                onChange: (event) =>
                  setFilterFormValues({
                    ...filterFormValues,
                    [name]: event.currentTarget.value,
                  }),
              }}
            />
          );
        }),
      },
      onReset: () => resetFilters(fields.map(({ name }) => name)),
    }),
  );

  return (
    <BackofficeDashboardTabContent
      title="Consulter les conventions"
      description="Conventions correspondant aux filtres, de la plus récente à la plus ancienne date de la demande. Cliquer sur une ligne pour accéder à la convention."
      titleAction={
        metabaseDashboardUrl ? (
          <MetabaseFullScreenButton
            id={domElementIds.adminConventions.conventionListMetabaseBackupLink}
            url={metabaseDashboardUrl}
            label="Ouvrir l'ancien tableau Metabase"
          />
        ) : null
      }
    >
      <WithFeedbackReplacer topic={feedbackTopic}>
        {hasSubmittedInvalidFilters && !filterFormValidation.success && (
          <Alert
            small
            severity="error"
            className={fr.cx("fr-mb-2w")}
            description={filterFormValidation.error.issues
              .map(({ path, message }) =>
                toFilterIssueMessage(path[0], message),
              )
              .join(" ")}
          />
        )}
        <p className={fr.cx("fr-text--sm", "fr-mb-2w")}>
          {toResultCountLabel(pagination.totalRecords)}
        </p>
        <div
          id={domElementIds.adminConventions.conventionListTable}
          className={Styles.root}
        >
          <RichTable
            label="Liste des conventions"
            hasViewSwitch={false}
            isLoading={isLoading}
            searchBar={{
              label: "Rechercher",
              placeholder:
                "Identifiant de convention, SIRET, email, nom du bénéficiaire ou de l'entreprise",
              hintText: `L'email et le SIRET doivent être complets, les noms peuvent être partiels (${adminConventionListTextFilterMinLength} caractères minimum).`,
              onSubmit: searchConventions,
            }}
            dropdownFilters={{
              items: [statusDropdownFilter, ...groupDropdownFilters],
              onSubmit: () => applyFilters(filterFormValues),
            }}
            headers={
              conventions.length > 0
                ? [
                    "Conseiller (FT Connect)",
                    "Statut",
                    "Structure",
                    "Bénéficiaire",
                    "Entreprise",
                    "Métier",
                    "Dates de l'immersion",
                  ]
                : ["Aucune convention trouvée avec ces filtres."]
            }
            tableData={conventions.map(makeAdminConventionListLine)}
            pagination={{
              count: pagination.totalPages,
              defaultPage: pagination.currentPage,
              showFirstLast: true,
              getPageLinkProps: (pageNumber) => ({
                title: `Résultats de recherche, page : ${pageNumber}`,
                onClick: (event) => {
                  event.preventDefault();
                  fetchConventions({ ...filters, page: pageNumber });
                },
                href: "#",
                key: `pagination-link-${pageNumber}`,
              }),
            }}
          />
        </div>
      </WithFeedbackReplacer>
    </BackofficeDashboardTabContent>
  );
};

const toFilterIssueMessage = (
  filterName: PropertyKey | undefined,
  message: string,
): string => {
  const filterField = Object.values(filterFields).find(
    ({ name }) => name === filterName,
  );
  return filterField ? `${filterField.label} : ${message}` : message;
};

const toValues = (appliedFilterLabel: string | undefined): string[] =>
  appliedFilterLabel ? [appliedFilterLabel] : [];

const toFlatGetConventionsForAdminParams = (
  filterFormValues: FilterFormValues,
): FlatGetConventionsForAdminParams => ({
  ...(isNotEmptyArray(filterFormValues.statuses)
    ? { statuses: filterFormValues.statuses }
    : {}),
  search: toOptionalFilter(filterFormValues.search),
  agencyNameContains: toOptionalFilter(filterFormValues.agencyNameContains),
  dateStartFrom: toOptionalFilter(filterFormValues.dateStartFrom),
  dateStartTo: toOptionalFilter(filterFormValues.dateStartTo),
  dateValidationFrom: toOptionalFilter(filterFormValues.dateValidationFrom),
  dateValidationTo: toOptionalFilter(filterFormValues.dateValidationTo),
  page: 1,
  perPage: defaultPerPageInWebPagination,
});

const toOptionalFilter = (value: string): string | undefined =>
  value.trim() || undefined;

const agencyKindToShortLabel: Record<AgencyKind, string> = {
  ...agencyKindToLabelIncludingIFAndPrepa,
  "france-travail": "France Travail",
};

const makeAdminConventionListLine = (
  convention: AdminConventionListDto,
): React.ReactNode[] => {
  const ftConnectAdvisor =
    convention.beneficiary.federatedIdentity?.payload?.advisor;

  return [
    ftConnectAdvisor ? (
      <Fragment key={`${convention.id}-ft-connect-advisor`}>
        <strong>
          {getFormattedFirstnameAndLastname({
            firstname: ftConnectAdvisor.firstName,
            lastname: ftConnectAdvisor.lastName,
          })}
        </strong>
        <SecondaryLine>{ftConnectAdvisor.email}</SecondaryLine>
      </Fragment>
    ) : (
      ""
    ),
    <Fragment key={`${convention.id}-status`}>
      <ConventionStatusBadge
        conventionStatus={convention.status}
        userKind="agency"
      />
      <SecondaryLine>
        Demandée le{" "}
        {toDisplayedDate({ date: new Date(convention.dateSubmission) })}
      </SecondaryLine>
    </Fragment>,
    <Fragment key={`${convention.id}-agency`}>
      <strong>{convention.agency.name}</strong>
      <SecondaryLine>
        {[
          agencyKindToShortLabel[convention.agency.kind],
          convention.agency.departmentName,
        ]
          .filter(Boolean)
          .join(" · ")}
      </SecondaryLine>
      {convention.agency.refersToAgencyName && (
        <SecondaryLine>
          Structure d'accompagnement liée à{" "}
          {convention.agency.refersToAgencyName}
        </SecondaryLine>
      )}
    </Fragment>,
    <Fragment key={`${convention.id}-beneficiary`}>
      <a
        {...frontRoutes.adminConventionDetail({ conventionId: convention.id })
          .link}
        id={`${domElementIds.adminConventions.conventionListConventionLink}--${convention.id}`}
        className={Styles.rowLink}
      >
        <strong>
          {getFormattedFirstnameAndLastname({
            firstname: convention.beneficiary.firstName,
            lastname: convention.beneficiary.lastName,
          })}
        </strong>
      </a>
      {convention.beneficiary.federatedIdentity && (
        <div className={fr.cx("fr-mt-1w")}>
          <img
            src={logoFtSvg}
            alt=""
            aria-hidden="true"
            className={fr.cx("fr-icon--sm", "fr-mr-1w")}
          />
          <strong className={fr.cx("fr-text--sm", "fr-label--info")}>
            FT Connect
          </strong>
        </div>
      )}
    </Fragment>,
    <Fragment key={`${convention.id}-business`}>
      <strong>{convention.businessName}</strong>
      <SecondaryLine>{convention.siret}</SecondaryLine>
    </Fragment>,
    convention.immersionAppellation.appellationLabel,
    <ConventionDatesDisplay
      key={`${convention.id}-dates`}
      dateStart={convention.dateStart}
      dateEnd={convention.dateEnd}
    />,
  ];
};

const SecondaryLine = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => (
  <span className={fr.cx("fr-hint-text")}>{children}</span>
);
