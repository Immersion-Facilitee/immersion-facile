import { fr } from "@codegouvfr/react-dsfr";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Badge from "@codegouvfr/react-dsfr/Badge";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
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
  defaultPerPageInWebPagination,
  domElementIds,
  type FlatGetConventionsForAdminParams,
  flatGetConventionsForAdminParamsSchema,
  frontRoutes,
  isConventionArchived,
} from "shared";
import { ConventionAssessmentStatusBadge } from "src/app/components/convention/ConventionAssessmentStatusBadge";
import { ConventionDatesDisplay } from "src/app/components/convention/ConventionDatesDisplay";
import { ConventionStatusBadge } from "src/app/components/convention/ConventionStatusBadge";
import {
  AgencyReferentCell,
  BeneficiaryCell,
} from "src/app/components/convention/convention-list/ConventionListCells";
import {
  BeforeOrAfterDateFilter,
  type BeforeOrAfterDateFilterLabels,
  makeAssessmentCompletionStatusOptions,
  makeConventionStatusOptions,
  toAppliedAssessmentCompletionStatusLabel,
  toAppliedBeforeOrAfterDateLabel,
  toAppliedConventionStatusesLabel,
} from "src/app/components/convention/convention-list/conventionListFilters";
import { WithFeedbackReplacer } from "src/app/components/feedback/WithFeedbackReplacer";
import { BackofficeDashboardTabContent } from "src/app/components/layout/BackofficeDashboardTabContent";
import { MetabaseFullScreenButton } from "src/app/components/MetabaseFullScreenButton";
import { useAppSelector } from "src/app/hooks/reduxHooks";
import { useAdminDashboard } from "src/app/pages/admin/useAdminDashboard";
import { authSelectors } from "src/core-logic/domain/auth/auth.selectors";
import { conventionListSelectors } from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.selectors";
import {
  conventionListSlice,
  initialAdminConventionList,
} from "src/core-logic/domain/connected-user/conventionList/connectedUserConventionList.slice";
import type { FeedbackTopic } from "src/core-logic/domain/feedback/feedback.content";

type AdminConventionListFilters = Pick<
  FlatGetConventionsForAdminParams,
  | "statuses"
  | "assessmentCompletionStatus"
  | "agencyNameContains"
  | "dateStartFrom"
  | "dateStartTo"
  | "dateValidationFrom"
  | "dateValidationTo"
>;

const feedbackTopic: FeedbackTopic = "admin-convention-list";

const agencyNameFilterLabel = "Agence";

const dateStartFilterLabels: BeforeOrAfterDateFilterLabels = {
  defaultLabel: "Date de début",
  before: "Démarrant avant le",
  after: "Démarrant après le",
};

const dateValidationFilterLabels: BeforeOrAfterDateFilterLabels = {
  defaultLabel: "Date de validation",
  before: "Validée avant le",
  after: "Validée après le",
};

const toResultCountLabel = (totalRecords: number): string => {
  if (totalRecords >= adminConventionListMaxResults)
    return `${adminConventionListMaxResults} conventions ou plus : seules les ${adminConventionListMaxResults} plus récentes sont consultables, affinez les filtres pour trouver les plus anciennes.`;
  if (totalRecords <= 1) return `${totalRecords} convention`;
  return `${totalRecords} conventions`;
};

const toFlatGetConventionsForAdminParams = (
  filtersToApply: AdminConventionListFilters,
  search: string | undefined,
): FlatGetConventionsForAdminParams => ({
  ...filtersToApply,
  agencyNameContains: filtersToApply.agencyNameContains?.trim() || undefined,
  search,
  page: 1,
  perPage: defaultPerPageInWebPagination,
});

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
  const [tempFilters, setTempFilters] = useState<AdminConventionListFilters>(
    {},
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

  const filtersValidation = flatGetConventionsForAdminParamsSchema.safeParse(
    toFlatGetConventionsForAdminParams(tempFilters, filters.search),
  );
  const filtersErrorMessage =
    hasSubmittedInvalidFilters && !filtersValidation.success
      ? filtersValidation.error.issues
          .map(({ path, message }) =>
            path[0] === "agencyNameContains"
              ? `${agencyNameFilterLabel} : ${message}`
              : message,
          )
          .join(" ")
      : undefined;

  const fetchConventions = (
    filtersToFetch: FlatGetConventionsForAdminParams,
  ): void => {
    dispatch(
      conventionListSlice.actions.fetchAdminConventionListRequested({
        jwt: connectedUserJwt,
        filters: filtersToFetch,
        feedbackTopic,
      }),
    );
  };

  const applyFilters = (
    filtersToApply: AdminConventionListFilters,
    search: string | undefined,
  ): void => {
    const validation = flatGetConventionsForAdminParamsSchema.safeParse(
      toFlatGetConventionsForAdminParams(filtersToApply, search),
    );
    setHasSubmittedInvalidFilters(!validation.success);
    if (validation.success) fetchConventions(validation.data);
  };

  const resetFilters = (resetValues: AdminConventionListFilters): void => {
    const filtersToApply = { ...tempFilters, ...resetValues };
    setTempFilters(filtersToApply);
    applyFilters(filtersToApply, filters.search);
  };

  const searchConventions = (query: string): void => {
    const search = query.trim();
    if (search === (filters.search ?? "")) return;
    if (search && search.length < adminConventionListTextFilterMinLength)
      return;
    applyFilters(tempFilters, search || undefined);
  };

  const dropdownFilters: RichDropdownProps[] = [
    {
      id: `${domElementIds.adminConventions.conventionListFilterDropdown}--status`,
      iconId: "fr-icon-equalizer-line",
      defaultValue: "Tous les statuts",
      values: [toAppliedConventionStatusesLabel(filters.statuses)],
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
      onReset: () => resetFilters({ statuses: undefined }),
    },
    {
      id: `${domElementIds.adminConventions.conventionListFilterDropdown}--assessment`,
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
              selectedValues: tempFilters.assessmentCompletionStatus,
              onChange: (assessmentCompletionStatus) =>
                setTempFilters({ ...tempFilters, assessmentCompletionStatus }),
            })}
          />
        ),
      },
      onReset: () => resetFilters({ assessmentCompletionStatus: undefined }),
    },
    {
      id: `${domElementIds.adminConventions.conventionListFilterDropdown}--dateStart`,
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
      onReset: () =>
        resetFilters({ dateStartFrom: undefined, dateStartTo: undefined }),
    },
    {
      id: `${domElementIds.adminConventions.conventionListFilterDropdown}--dateValidation`,
      iconId: "fr-icon-calendar-line",
      defaultValue: dateValidationFilterLabels.defaultLabel,
      values: [
        toAppliedBeforeOrAfterDateLabel(dateValidationFilterLabels, {
          from: filters.dateValidationFrom,
          to: filters.dateValidationTo,
        }),
      ],
      submenu: {
        title: "Filtrer par date de validation",
        content: (
          <BeforeOrAfterDateFilter
            labels={dateValidationFilterLabels}
            value={{
              from: tempFilters.dateValidationFrom,
              to: tempFilters.dateValidationTo,
            }}
            onChange={({ from, to }) =>
              setTempFilters({
                ...tempFilters,
                dateValidationFrom: from,
                dateValidationTo: to,
              })
            }
          />
        ),
      },
      onReset: () =>
        resetFilters({
          dateValidationFrom: undefined,
          dateValidationTo: undefined,
        }),
    },
    {
      id: `${domElementIds.adminConventions.conventionListFilterDropdown}--agency`,
      iconId: "fr-icon-building-line",
      defaultValue: "Toutes les agences",
      values: [
        filters.agencyNameContains
          ? `${agencyNameFilterLabel} : ${filters.agencyNameContains}`
          : "Toutes les agences",
      ],
      submenu: {
        title: "Filtrer par agence",
        content: (
          <Input
            label={agencyNameFilterLabel}
            hintText={`${adminConventionListTextFilterMinLength} caractères minimum`}
            state={filtersErrorMessage ? "error" : "default"}
            stateRelatedMessage={filtersErrorMessage}
            nativeInputProps={{
              id: `${domElementIds.adminConventions.conventionListFilterInput}--agencyNameContains`,
              name: "agencyNameContains",
              value: tempFilters.agencyNameContains ?? "",
              onChange: (event) =>
                setTempFilters({
                  ...tempFilters,
                  agencyNameContains: event.currentTarget.value,
                }),
            }}
          />
        ),
      },
      onReset: () => resetFilters({ agencyNameContains: undefined }),
    },
  ];

  return (
    <BackofficeDashboardTabContent
      title="Consulter les conventions"
      description="Conventions correspondant aux filtres, de la plus récente à la plus ancienne date de la demande."
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
        {filtersErrorMessage && (
          <Alert
            small
            severity="error"
            className={fr.cx("fr-mb-2w")}
            description={filtersErrorMessage}
          />
        )}
        <p className={fr.cx("fr-text--sm", "fr-mb-2w")}>
          {toResultCountLabel(pagination.totalRecords)}
        </p>
        <RichTable
          label="Liste des conventions"
          hasViewSwitch={false}
          isLoading={isLoading}
          searchBar={{
            label: "Rechercher",
            placeholder:
              "Rechercher une convention (ID, nom, prénom, conseiller, entreprise, email, SIRET)",
            hintText: `Astuce : saisir un nom de conseiller dans la recherche permet d’afficher uniquement ses conventions. Pour une agence, utilisez le filtre Agence. L'email et le SIRET doivent être complets, les noms peuvent être partiels (${adminConventionListTextFilterMinLength} caractères minimum).`,
            onSubmit: searchConventions,
          }}
          dropdownFilters={{
            items: dropdownFilters,
            onSubmit: () => applyFilters(tempFilters, filters.search),
          }}
          headers={
            conventions.length > 0
              ? [
                  "Conseiller",
                  "Structure",
                  "Statut",
                  "Bilan",
                  "Personne en immersion",
                  "Établissement",
                  "Dates",
                  "Actions",
                ]
              : [
                  "Aucune convention trouvée avec ces filtres, vous pouvez modifier les filtres pour élargir votre recherche.",
                ]
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
      </WithFeedbackReplacer>
    </BackofficeDashboardTabContent>
  );
};

const agencyKindToShortLabel: Record<AgencyKind, string> = {
  ...agencyKindToLabelIncludingIFAndPrepa,
  "france-travail": "France Travail",
};

const makeAdminConventionListLine = (
  convention: AdminConventionListDto,
): React.ReactNode[] => [
  <AgencyReferentCell
    key={`${convention.id}-counsellor`}
    agencyReferent={convention.agencyReferent}
    agencyName={convention.agencyName}
  />,
  <Fragment key={`${convention.id}-agency`}>
    <strong>{convention.agencyName}</strong>
    <span className={fr.cx("fr-hint-text")}>
      {[
        agencyKindToShortLabel[convention.agencyKind],
        convention.agencyDepartmentName,
      ]
        .filter(Boolean)
        .join(" · ")}
    </span>
    {convention.agencyRefersToAgencyName && (
      <span className={fr.cx("fr-hint-text")}>
        Structure d'accompagnement liée à {convention.agencyRefersToAgencyName}
      </span>
    )}
  </Fragment>,
  <ul
    key={`${convention.id}-status`}
    className={fr.cx("fr-badges-group", "fr-badges-group--sm")}
  >
    <li>
      <ConventionStatusBadge
        conventionStatus={convention.status}
        userKind="agency"
      />
    </li>
    {isConventionArchived({ dateEnd: convention.dateEnd, now: new Date() }) && (
      <li>
        <Badge small>Archivée</Badge>
      </li>
    )}
  </ul>,
  <ConventionAssessmentStatusBadge
    key={`${convention.id}-assessment`}
    conventionParams={convention}
    userKind="agency"
  />,
  <BeneficiaryCell
    key={`${convention.id}-beneficiary`}
    beneficiary={convention.beneficiary}
  />,
  <strong key={`${convention.id}-establishment`}>
    {convention.businessName}
  </strong>,
  <ConventionDatesDisplay
    key={`${convention.id}-dates`}
    dateStart={convention.dateStart}
    dateEnd={convention.dateEnd}
  />,
  <Button
    key={`${convention.id}-actions`}
    id={`${domElementIds.adminConventions.conventionListManageConventionButton}--${convention.id}`}
    size="small"
    priority="secondary"
    linkProps={{
      ...frontRoutes.adminConventionDetail({ conventionId: convention.id })
        .link,
      target: "_blank",
    }}
  >
    Piloter
  </Button>,
];
